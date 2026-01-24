import type { Track, BeatMap } from '../types';
import { getBpmAtTime } from './midiParser';

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private currentTrack: Track | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPlaying: boolean = false;
  private duckLevel: number = 0.18; // -15dB ≈ 0.18
  private isDucked: boolean = false;

  async init(): Promise<void> {
    if (this.audioContext) return;
    
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }

  async loadTrack(track: Track): Promise<void> {
    if (!this.audioContext) await this.init();
    
    const arrayBuffer = await track.audioBlob.arrayBuffer();
    this.currentBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    this.currentTrack = track;
  }

  play(): void {
    if (!this.audioContext || !this.currentBuffer || !this.masterGain) return;
    
    this.stop();
    
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = this.currentBuffer;
    
    this.currentGain = this.audioContext.createGain();
    this.currentGain.gain.value = 1;
    
    this.currentSource.connect(this.currentGain);
    this.currentGain.connect(this.masterGain);
    
    const offset = this.pauseTime;
    this.currentSource.start(0, offset);
    this.startTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;
    
    this.currentSource.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pauseTime = 0;
      }
    };
  }

  pause(): void {
    if (!this.isPlaying || !this.audioContext) return;
    
    this.pauseTime = this.audioContext.currentTime - this.startTime;
    this.currentSource?.stop();
    this.isPlaying = false;
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    if (this.currentGain) {
      this.currentGain.disconnect();
      this.currentGain = null;
    }
    this.isPlaying = false;
    this.pauseTime = 0;
  }

  setDuck(enabled: boolean): void {
    if (!this.masterGain) return;
    
    this.isDucked = enabled;
    const targetGain = enabled ? this.duckLevel : 1;
    
    this.masterGain.gain.setTargetAtTime(
      targetGain,
      this.audioContext!.currentTime,
      0.05
    );
  }

  getDuckState(): boolean {
    return this.isDucked;
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) return this.pauseTime;
    return this.audioContext.currentTime - this.startTime;
  }

  getDuration(): number {
    return this.currentBuffer?.duration ?? 0;
  }

  getCurrentBpm(): number {
    if (!this.currentTrack) return 120;
    const time = this.getCurrentTime();
    return getBpmAtTime(this.currentTrack.beatMap, time);
  }

  getBeatMap(): BeatMap | null {
    return this.currentTrack?.beatMap ?? null;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

export const audioEngine = new AudioEngine();
