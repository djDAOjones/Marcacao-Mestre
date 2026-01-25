import type { Track, QueueItem } from '../types';
import { Deck } from './deck';
import { getNextDownbeat, getNativeBpm, type BeatPosition } from './beatScheduler';

export type TransitionPhase = 'idle' | 'queued' | 'mixing' | 'playing';

export interface TransportState {
  phase: TransitionPhase;
  currentTrack: Track | null;
  nextTrack: Track | null;
  queue: QueueItem[];
  currentBpm: number;
  targetBpm: number;
  mixProgress: number;
  mixLengthBars: number;
  beatPosition: BeatPosition | null;
  isPaused: boolean;
}

export type MixLengthBars = 0 | 1 | 2 | 4 | 8;

export interface EngineConfig {
  quantiseOn: boolean;
  mixLengthBars: MixLengthBars;
  duckLevel: number;
}

type DeckId = 'A' | 'B';

class DualDeckEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  private deckA: Deck | null = null;
  private deckB: Deck | null = null;
  private activeDeck: DeckId = 'A';
  
  private phase: TransitionPhase = 'idle';
  private queue: QueueItem[] = [];
  private activeQueueItem: QueueItem | null = null;
  private queueIdCounter: number = 0;
  
  private config: EngineConfig = {
    quantiseOn: false,
    mixLengthBars: 2,
    duckLevel: 0.18,
  };
  
  private isDucked: boolean = false;
  private targetBpm: number = 120;
  
  private mixStartTime: number = 0;
  private mixDuration: number = 0;
  private schedulerInterval: number | null = null;
  private pendingMixTime: number | null = null; // Scheduled time to start mix

  async init(): Promise<void> {
    if (this.audioContext) return;
    
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    this.deckA = new Deck(this.audioContext, this.masterGain);
    this.deckB = new Deck(this.audioContext, this.masterGain);
    
    // Start scheduler
    this.startScheduler();
  }

  private startScheduler(): void {
    if (this.schedulerInterval) return;
    
    const tick = () => {
      this.schedulerTick();
      this.schedulerInterval = requestAnimationFrame(tick);
    };
    tick();
  }

  private schedulerTick(): void {
    if (!this.audioContext) return;
    
    const activeDeck = this.getActiveDeck();
    const inactiveDeck = this.getInactiveDeck();
    
    // Check if current track finished
    if (activeDeck?.isFinished()) {
      if (this.phase === 'playing' && this.queue.length === 0) {
        this.phase = 'idle';
      }
    }
    
    // Handle mixing phase
    if (this.phase === 'mixing' && this.mixDuration > 0) {
      const elapsed = this.audioContext.currentTime - this.mixStartTime;
      const progress = Math.min(elapsed / this.mixDuration, 1);
      
      // Equal-power crossfade
      const outVolume = Math.cos(progress * Math.PI / 2);
      const inVolume = Math.sin(progress * Math.PI / 2);
      
      activeDeck?.setVolume(outVolume);
      inactiveDeck?.setVolume(inVolume);
      
      // Handle tempo during mix
      if (this.config.quantiseOn) {
        // Both decks play at target BPM
        const rate = this.targetBpm / (activeDeck?.getNativeBpm() ?? 120);
        activeDeck?.setPlaybackRate(rate);
        const incomingRate = this.targetBpm / (inactiveDeck?.getNativeBpm() ?? 120);
        inactiveDeck?.setPlaybackRate(incomingRate);
      } else {
        // Tempo slide: interpolate from current native to incoming native
        const currentNative = activeDeck?.getNativeBpm() ?? 120;
        const incomingNative = inactiveDeck?.getNativeBpm() ?? 120;
        const slidingBpm = currentNative + (incomingNative - currentNative) * progress;
        
        const outRate = slidingBpm / currentNative;
        const inRate = slidingBpm / incomingNative;
        
        activeDeck?.setPlaybackRate(outRate);
        inactiveDeck?.setPlaybackRate(inRate);
        
        this.targetBpm = slidingBpm;
      }
      
      // Mix complete
      if (progress >= 1) {
        this.completeMix();
      }
    }
    
    // Handle queued track waiting for downbeat
    if (this.phase === 'queued' && activeDeck?.isPlaying()) {
      const beatMap = activeDeck.getBeatMap();
      const currentTime = activeDeck.getCurrentTime();
      const now = this.audioContext.currentTime;
      
      // Schedule the mix start time if not already scheduled
      if (this.pendingMixTime === null) {
        if (beatMap) {
          const nextDownbeat = getNextDownbeat(beatMap, currentTime, activeDeck.getEffectiveBpm());
          const timeUntilDownbeat = nextDownbeat.timeSeconds - currentTime;
          this.pendingMixTime = now + timeUntilDownbeat;
          console.log(`[DualDeck] Mix scheduled in ${timeUntilDownbeat.toFixed(2)}s at bar ${nextDownbeat.bar}`);
        } else {
          // No beatmap - start mix after a short delay (next bar approximation)
          const approxBarDuration = (60 / this.targetBpm) * 4;
          this.pendingMixTime = now + approxBarDuration;
          console.log(`[DualDeck] No beatmap - mix scheduled in ${approxBarDuration.toFixed(2)}s`);
        }
      }
      
      // Check if it's time to start the mix
      if (this.pendingMixTime !== null && now >= this.pendingMixTime - 0.01) {
        console.log('[DualDeck] Starting mix now');
        this.pendingMixTime = null;
        this.startMix();
      }
    }
  }

  private startMix(): void {
    const activeDeck = this.getActiveDeck();
    const inactiveDeck = this.getInactiveDeck();
    
    if (!activeDeck || !inactiveDeck || !this.activeQueueItem || !this.audioContext) {
      console.warn('[DualDeck] startMix aborted - missing deck or track');
      return;
    }
    
    // Set playback rate for incoming track
    if (this.config.quantiseOn) {
      const incomingRate = this.targetBpm / inactiveDeck.getNativeBpm();
      inactiveDeck.setPlaybackRate(incomingRate);
    } else {
      // Start at current track's tempo (will slide during mix if applicable)
      const currentRate = activeDeck.getNativeBpm() / inactiveDeck.getNativeBpm();
      inactiveDeck.setPlaybackRate(currentRate);
    }
    
    // Handle hard cut (mixLengthBars = 0)
    if (this.config.mixLengthBars === 0) {
      console.log(`[DualDeck] Hard cut to: ${this.activeQueueItem.track.name}`);
      activeDeck.stop();
      inactiveDeck.setVolume(1);
      inactiveDeck.play(0);
      inactiveDeck.setState('playing');
      this.activeDeck = this.activeDeck === 'A' ? 'B' : 'A';
      if (!this.config.quantiseOn) {
        this.targetBpm = this.getActiveDeck()?.getNativeBpm() ?? 120;
      }
      this.phase = 'playing';
      this.activeQueueItem = null;
      this.advanceQueue();
      return;
    }
    
    // Calculate mix duration in seconds
    const beatMap = activeDeck.getBeatMap();
    const bpm = this.config.quantiseOn ? this.targetBpm : activeDeck.getEffectiveBpm();
    const beatsPerBar = beatMap?.timeSignature.numerator ?? 4;
    const barDuration = (60 / bpm) * beatsPerBar;
    this.mixDuration = barDuration * this.config.mixLengthBars;
    
    console.log(`[DualDeck] Mix starting: ${this.config.mixLengthBars} bars = ${this.mixDuration.toFixed(2)}s at ${bpm.toFixed(1)} BPM`);
    this.mixStartTime = this.audioContext.currentTime;
    
    // Start incoming deck at zero volume for crossfade
    inactiveDeck.setVolume(0);
    inactiveDeck.play(0);
    inactiveDeck.setState('fading-in');
    activeDeck.setState('fading-out');
    
    this.phase = 'mixing';
    console.log(`[DualDeck] Phase -> mixing, incoming track: ${this.activeQueueItem.track.name}`);
  }

  private completeMix(): void {
    const activeDeck = this.getActiveDeck();
    const inactiveDeck = this.getInactiveDeck();
    
    // Stop outgoing deck
    activeDeck?.stop();
    activeDeck?.setVolume(1);
    
    // Set incoming deck to full volume
    inactiveDeck?.setVolume(1);
    inactiveDeck?.setState('playing');
    
    // Swap active deck
    this.activeDeck = this.activeDeck === 'A' ? 'B' : 'A';
    
    // Update target BPM if not quantised
    if (!this.config.quantiseOn) {
      this.targetBpm = this.getActiveDeck()?.getNativeBpm() ?? 120;
    }
    
    this.phase = 'playing';
    console.log(`[DualDeck] Mix complete, now playing: ${this.getActiveDeck()?.getTrack()?.name}`);
    this.activeQueueItem = null;
    this.mixDuration = 0;
    this.advanceQueue();
  }

  /** Move next item from queue to activeQueueItem and start transition */
  private advanceQueue(): void {
    if (this.queue.length > 0) {
      const nextItem = this.queue.shift()!;
      this.prepareQueueItem(nextItem);
    }
  }

  /** Prepare a queue item for transition (load into inactive deck) */
  private async prepareQueueItem(item: QueueItem): Promise<void> {
    const inactiveDeck = this.getInactiveDeck();
    if (!inactiveDeck) return;
    
    await inactiveDeck.loadTrack(item.track);
    this.activeQueueItem = item;
    this.pendingMixTime = null;
    this.phase = 'queued';
    console.log(`[DualDeck] Next track ready: ${item.track.name}`);
  }

  async loadAndPlayTrack(track: Track): Promise<void> {
    console.log(`[DualDeck] loadAndPlayTrack called: ${track.name}`);
    console.log(`[DualDeck] Current phase: ${this.phase}, audioContext: ${!!this.audioContext}`);
    
    if (!this.audioContext) await this.init();
    
    const activeDeck = this.getActiveDeck();
    const isPlaying = activeDeck?.isPlaying() ?? false;
    console.log(`[DualDeck] Active deck playing: ${isPlaying}`);
    
    // If deck is playing, queue for crossfade transition
    if (isPlaying) {
      console.log(`[DualDeck] -> queueTrack for transition (deck is playing)`);
      await this.queueTrack(track);
      return;
    }
    
    // Nothing playing, start immediately
    console.log(`[DualDeck] -> playTrackImmediately (nothing playing)`);
    await this.playTrackImmediately(track);
  }

  private async playTrackImmediately(track: Track): Promise<void> {
    console.log(`[DualDeck] playTrackImmediately: ${track.name}`);
    const deck = this.getActiveDeck();
    if (!deck) {
      console.warn('[DualDeck] No active deck available');
      return;
    }
    
    await deck.loadTrack(track);
    console.log(`[DualDeck] Track loaded into deck`);
    
    // Set initial BPM
    this.targetBpm = this.config.quantiseOn ? this.targetBpm : getNativeBpm(track.beatMap);
    
    if (this.config.quantiseOn) {
      const rate = this.targetBpm / deck.getNativeBpm();
      deck.setPlaybackRate(rate);
    } else {
      deck.setPlaybackRate(1);
      this.targetBpm = deck.getNativeBpm();
    }
    
    deck.setVolume(1);
    deck.play(0);
    this.phase = 'playing';
  }

  /** Add a track to the end of the queue */
  addToQueue(track: Track, position: 'end' | 'next' = 'end'): void {
    const queueItem: QueueItem = {
      id: `q-${++this.queueIdCounter}`,
      track,
      settings: {
        mixLengthBars: this.config.mixLengthBars,
        quantiseOn: this.config.quantiseOn,
        targetBpm: this.targetBpm,
      },
      queuedAt: Date.now(),
    };
    
    if (position === 'next') {
      this.queue.unshift(queueItem);
    } else {
      this.queue.push(queueItem);
    }
    
    console.log(`[DualDeck] Track added to queue (${position}): ${track.name}`);
    
    // If nothing is being prepared, prepare the first item
    if (!this.activeQueueItem && this.phase === 'playing') {
      this.advanceQueue();
    }
  }

  /** Queue a track for immediate transition (legacy compatibility) */
  async queueTrack(track: Track): Promise<void> {
    // Create queue item and prepare immediately
    const queueItem: QueueItem = {
      id: `q-${++this.queueIdCounter}`,
      track,
      settings: {
        mixLengthBars: this.config.mixLengthBars,
        quantiseOn: this.config.quantiseOn,
        targetBpm: this.targetBpm,
      },
      queuedAt: Date.now(),
    };
    
    await this.prepareQueueItem(queueItem);
    console.log(`[DualDeck] Track queued for immediate transition: ${track.name}`);
  }

  cancelQueue(): void {
    this.activeQueueItem = null;
    if (this.phase === 'queued') {
      this.phase = 'playing';
    }
  }

  /** Remove an item from the queue by its ID */
  removeFromQueue(itemId: string): void {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0];
      console.log(`[DualDeck] Removed from queue: ${removed.track.name}`);
    }
  }

  /** Get the current queue */
  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  stop(): void {
    this.deckA?.stop();
    this.deckB?.stop();
    this.phase = 'idle';
    this.activeQueueItem = null;
    this.queue = [];
    this.mixDuration = 0;
    this.pendingMixTime = null;
    console.log('[DualDeck] Stopped');
  }

  setDuck(enabled: boolean): void {
    if (!this.masterGain || !this.audioContext) return;
    
    this.isDucked = enabled;
    const targetGain = enabled ? this.config.duckLevel : 1;
    
    this.masterGain.gain.setTargetAtTime(
      targetGain,
      this.audioContext.currentTime,
      0.05
    );
  }

  setTargetBpm(bpm: number): void {
    this.targetBpm = Math.max(60, Math.min(200, bpm));
    
    if (this.config.quantiseOn && this.phase === 'playing') {
      const activeDeck = this.getActiveDeck();
      if (activeDeck) {
        const rate = this.targetBpm / activeDeck.getNativeBpm();
        activeDeck.setPlaybackRate(rate);
      }
    }
  }

  setConfig(config: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getTransportState(): TransportState {
    const activeDeck = this.getActiveDeck();
    
    let mixProgress = 0;
    if (this.phase === 'mixing' && this.mixDuration > 0 && this.audioContext) {
      const elapsed = this.audioContext.currentTime - this.mixStartTime;
      mixProgress = Math.min(elapsed / this.mixDuration, 1);
    }
    
    return {
      phase: this.phase,
      currentTrack: activeDeck?.getTrack() ?? null,
      nextTrack: this.activeQueueItem?.track ?? this.queue[0]?.track ?? null,
      queue: [...this.queue],
      currentBpm: activeDeck?.getEffectiveBpm() ?? this.targetBpm,
      targetBpm: this.targetBpm,
      mixProgress,
      mixLengthBars: this.config.mixLengthBars,
      beatPosition: activeDeck?.getStatus().beatPosition ?? null,
      isPaused: activeDeck?.isPaused() ?? false,
    };
  }

  getCurrentTrack(): Track | null {
    return this.getActiveDeck()?.getTrack() ?? null;
  }

  getQueuedTrack(): Track | null {
    return this.activeQueueItem?.track ?? this.queue[0]?.track ?? null;
  }

  isPlaying(): boolean {
    return this.phase !== 'idle';
  }

  getDuckState(): boolean {
    return this.isDucked;
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  pause(): void {
    const activeDeck = this.getActiveDeck();
    if (activeDeck?.isPlaying()) {
      activeDeck.pause();
      console.log('[DualDeck] Paused');
    }
  }

  resumePlayback(): void {
    const activeDeck = this.getActiveDeck();
    if (activeDeck?.isPaused()) {
      activeDeck.resume();
      console.log('[DualDeck] Resumed');
    }
  }

  togglePause(): void {
    const activeDeck = this.getActiveDeck();
    if (activeDeck?.isPaused()) {
      this.resumePlayback();
    } else if (activeDeck?.isPlaying()) {
      this.pause();
    }
  }

  private getActiveDeck(): Deck | null {
    return this.activeDeck === 'A' ? this.deckA : this.deckB;
  }

  private getInactiveDeck(): Deck | null {
    return this.activeDeck === 'A' ? this.deckB : this.deckA;
  }
}

export const dualDeckEngine = new DualDeckEngine();
