import { PitchShifter } from 'soundtouchjs';
import type { Track, BeatMap } from '../types';
import { getNativeBpm, getBeatPositionAtTime, type BeatPosition } from './beatScheduler';

export type DeckState = 'idle' | 'loading' | 'playing' | 'fading-in' | 'fading-out';

export interface DeckStatus {
  state: DeckState;
  track: Track | null;
  currentTime: number;
  volume: number;
  playbackRate: number;
  beatPosition: BeatPosition | null;
}

export class Deck {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  
  private audioBuffer: AudioBuffer | null = null;
  private shifter: PitchShifter | null = null;
  private track: Track | null = null;
  
  private state: DeckState = 'idle';
  private playbackRate: number = 1.0;
  private volume: number = 1.0;
  
  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.connect(outputNode);
  }

  async loadTrack(track: Track): Promise<void> {
    this.state = 'loading';
    this.track = track;
    
    const arrayBuffer = await track.audioBlob.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    this.state = 'idle';
  }

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
    
    this.state = 'playing';
    
    // Handle end of track
    this.shifter.on('play', (_detail: unknown) => {
      // Track is playing
    });
  }

  stop(): void {
    if (this.shifter) {
      this.shifter.disconnect();
      this.shifter = null;
    }
    this.state = 'idle';
  }

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

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.shifter) {
      this.shifter.tempo = rate;
    }
  }

  getCurrentTime(): number {
    if (!this.shifter || !this.audioBuffer) return 0;
    return this.shifter.percentagePlayed * this.audioBuffer.duration;
  }

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

  getNativeBpm(): number {
    if (!this.track) return 120;
    return getNativeBpm(this.track.beatMap);
  }

  getEffectiveBpm(): number {
    return this.getNativeBpm() * this.playbackRate;
  }

  isPlaying(): boolean {
    return this.state === 'playing' || this.state === 'fading-in' || this.state === 'fading-out';
  }

  isFinished(): boolean {
    if (!this.shifter || !this.audioBuffer) return false;
    return this.shifter.percentagePlayed >= 1;
  }

  setState(state: DeckState): void {
    this.state = state;
  }

  getDuration(): number {
    return this.audioBuffer?.duration ?? 0;
  }
}
