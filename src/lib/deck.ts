/**
 * Deck — Individual audio playback unit using SoundTouch for tempo shifting.
 *
 * Each Deck holds one loaded track at a time. It handles play, pause, stop,
 * volume ramping, and playback-rate (tempo) changes. Two Deck instances are
 * managed by DualDeckEngine for gapless A/B mixing.
 *
 * Position tracking note:
 *   SoundTouchJS PitchShifter.percentagePlayed grows unboundedly past 1.0,
 *   so we track position manually using AudioContext.currentTime math.
 *   See accumulatedOffset / playStartAudioTime below.
 */

import { PitchShifter } from 'soundtouchjs';
import type { Track, BeatMap } from '../types';
import { getNativeBpm, getBeatPositionAtTime, type BeatPosition } from './beatScheduler';

/** Lifecycle state of a single deck */
export type DeckState = 'idle' | 'loading' | 'playing' | 'paused' | 'fading-in' | 'fading-out';

/** Read-only snapshot of deck state for UI consumption */
export interface DeckStatus {
  state: DeckState;
  track: Track | null;
  currentTime: number;
  volume: number;
  playbackRate: number;
  beatPosition: BeatPosition | null;
}

export class Deck {
  // ---------------------------------------------------------------------------
  // Audio graph
  // ---------------------------------------------------------------------------
  private audioContext: AudioContext;
  private gainNode: GainNode;

  // ---------------------------------------------------------------------------
  // Track data
  // ---------------------------------------------------------------------------
  private audioBuffer: AudioBuffer | null = null;
  private shifter: PitchShifter | null = null;
  private track: Track | null = null;

  // ---------------------------------------------------------------------------
  // Playback state
  // ---------------------------------------------------------------------------
  private state: DeckState = 'idle';
  private playbackRate: number = 1.0;
  private volume: number = 1.0;
  /** Track position (seconds) when paused — used to resume from the same spot */
  private pausedAt: number = 0;
  /** AudioContext.currentTime snapshot when play() was last called */
  private playStartAudioTime: number = 0;
  /** Accumulated track-time offset across rate changes (seconds in track-time) */
  private accumulatedOffset: number = 0;
  
  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.connect(outputNode);
  }

  /**
   * Decode an audio blob and store the buffer. Sets state to 'idle' when done.
   *
   * @param track     - Track metadata (beat map, duration, etc.)
   * @param audioBlob - Raw audio blob retrieved from IndexedDB (audioBlobCache)
   */
  async loadTrack(track: Track, audioBlob: Blob): Promise<void> {
    this.state = 'loading';
    this.track = track;
    
    const arrayBuffer = await audioBlob.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    this.state = 'idle';
  }

  /**
   * Start (or restart) playback from the given offset.
   * Creates a fresh PitchShifter instance and resets position tracking.
   *
   * @param startOffset - Track position in seconds to start from (default 0)
   */
  play(startOffset: number = 0): void {
    if (!this.audioBuffer || !this.track) return;
    
    this.stop();
    
    this.shifter = new PitchShifter(this.audioContext, this.audioBuffer, 4096);
    this.shifter.tempo = this.playbackRate;
    this.shifter.pitch = 1.0; // Preserve pitch
    this.shifter.connect(this.gainNode);
    
    // Seek to start offset
    if (startOffset > 0) {
      this.shifter.percentagePlayed = startOffset / this.audioBuffer.duration;
    }
    
    // Manual position tracking (percentagePlayed is unreliable)
    this.accumulatedOffset = startOffset;
    this.playStartAudioTime = this.audioContext.currentTime;
    
    this.state = 'playing';
    
    // Handle end of track
    this.shifter.on('play', (_detail: unknown) => {
      // Track is playing
    });
  }

  /** Stop playback — disconnects the PitchShifter and resets all position state */
  stop(): void {
    if (this.shifter) {
      this.shifter.disconnect();
      this.shifter = null;
    }
    this.pausedAt = 0;
    this.accumulatedOffset = 0;
    this.playStartAudioTime = 0;
    this.state = 'idle';
  }

  /** Pause playback — records current position and disconnects the shifter */
  pause(): void {
    if (!this.shifter || !this.audioBuffer) return;
    if (this.state !== 'playing' && this.state !== 'fading-in' && this.state !== 'fading-out') return;
    
    this.pausedAt = this.getCurrentTime();
    this.shifter.disconnect();
    this.shifter = null;
    this.state = 'paused';
  }

  /**
   * Seek to an arbitrary position (seconds). Works in both playing and paused states.
   * During playback, creates a fresh PitchShifter at the new position.
   */
  seek(position: number): void {
    if (!this.audioBuffer) return;
    const clamped = Math.max(0, Math.min(position, this.audioBuffer.duration - 0.05));
    if (this.state === 'paused') {
      this.pausedAt = clamped;
      return;
    }
    if (this.isPlaying()) {
      // Preserve current volume before recreating the shifter
      const currentVol = this.volume;
      this.play(clamped);
      this.setVolume(currentVol);
    }
  }

  /** Resume from paused state, optionally at a different position (e.g. after rewind) */
  resume(fromPosition?: number): void {
    if (this.state !== 'paused' || !this.audioBuffer) return;
    const position = fromPosition ?? this.pausedAt;
    this.play(position);
  }

  /**
   * Set deck volume with optional exponential ramp.
   * @param volume   - Target volume 0–1
   * @param rampTime - Ramp duration in seconds (0 = instant)
   */
  setVolume(volume: number, rampTime: number = 0): void {
    this.volume = volume;
    if (rampTime > 0) {
      this.gainNode.gain.setTargetAtTime(
        volume,
        this.audioContext.currentTime,
        rampTime / 3 // Time constant is ~1/3 of desired ramp time
      );
    } else {
      this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  /**
   * Change the playback rate (tempo). Accumulates elapsed time at the old rate
   * before applying the new rate, so getCurrentTime() stays accurate.
   */
  setPlaybackRate(rate: number): void {
    // Accumulate elapsed time at old rate before changing
    if (this.isPlaying() && this.playStartAudioTime > 0) {
      const now = this.audioContext.currentTime;
      this.accumulatedOffset += (now - this.playStartAudioTime) * this.playbackRate;
      this.playStartAudioTime = now;
    }
    this.playbackRate = rate;
    if (this.shifter) {
      this.shifter.tempo = rate;
    }
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  /**
   * Current playback position in track-seconds.
   * Uses manual AudioContext-timestamp tracking (not SoundTouch percentagePlayed).
   */
  getCurrentTime(): number {
    if (!this.audioBuffer) return 0;
    if (!this.isPlaying() && this.state === 'paused') return this.pausedAt;
    if (!this.shifter) return 0;
    // Manual tracking: accumulated offset + elapsed at current rate
    const elapsed = (this.audioContext.currentTime - this.playStartAudioTime) * this.playbackRate;
    return Math.min(this.accumulatedOffset + elapsed, this.audioBuffer.duration);
  }

  /** Build a read-only status snapshot for UI rendering */
  getStatus(): DeckStatus {
    const currentTime = this.getCurrentTime();
    let beatPosition: BeatPosition | null = null;
    
    if (this.track && this.state !== 'idle') {
      const effectiveBpm = this.getEffectiveBpm();
      beatPosition = getBeatPositionAtTime(this.track.beatMap, currentTime, effectiveBpm);
    }
    
    return {
      state: this.state,
      track: this.track,
      currentTime,
      volume: this.volume,
      playbackRate: this.playbackRate,
      beatPosition,
    };
  }

  getTrack(): Track | null {
    return this.track;
  }

  getBeatMap(): BeatMap | null {
    return this.track?.beatMap ?? null;
  }

  /** Native BPM from the track's first tempo event (default 120) */
  getNativeBpm(): number {
    if (!this.track) return 120;
    return getNativeBpm(this.track.beatMap);
  }

  /** Effective BPM accounting for current playback rate */
  getEffectiveBpm(): number {
    return this.getNativeBpm() * this.playbackRate;
  }

  isPlaying(): boolean {
    return this.state === 'playing' || this.state === 'fading-in' || this.state === 'fading-out';
  }

  isPaused(): boolean {
    return this.state === 'paused';
  }

  /** True when playback has reached (or passed) the end of the track */
  isFinished(): boolean {
    if (!this.audioBuffer) return false;
    if (!this.shifter) return false;
    return this.getCurrentTime() >= this.audioBuffer.duration - 0.05;
  }

  /** Override the deck state (used by DualDeckEngine during crossfade phases) */
  setState(state: DeckState): void {
    this.state = state;
  }

  /** Total duration of the loaded audio buffer in seconds */
  getDuration(): number {
    return this.audioBuffer?.duration ?? 0;
  }
}
