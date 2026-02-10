import type { Track, QueueItem, TransitionMode } from '../types';
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
  transitionMode: TransitionMode;
  beatPosition: BeatPosition | null;
  isPaused: boolean;
}

/**
 * Engine configuration (v4 simplified)
 * - transitionMode: 'mix' = 2-bar quantised crossfade, 'cut' = 50ms micro-fade
 * - fixTempo: when true, all tracks play at target BPM; when false, native speed
 */
export interface EngineConfig {
  transitionMode: TransitionMode;
  duckLevel: number;
  fixTempo: boolean;
}

type DeckId = 'A' | 'B';

/** Callback fired when the current track finishes and no queued track follows */
export type OnTrackEndedCallback = () => void;

class DualDeckEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckFilter: BiquadFilterNode | null = null; // EQ filter for duck
  
  private deckA: Deck | null = null;
  private deckB: Deck | null = null;
  private activeDeck: DeckId = 'A';
  
  private phase: TransitionPhase = 'idle';
  private queue: QueueItem[] = [];
  private activeQueueItem: QueueItem | null = null;
  private queueIdCounter: number = 0;
  
  /** Called when a track ends with nothing queued (for auto-advance) */
  private onTrackEnded: OnTrackEndedCallback | null = null;
  
  private config: EngineConfig = {
    transitionMode: 'mix',
    duckLevel: 0.18,
    fixTempo: false, // Default: tracks play at native speed
  };
  
  // Pause state for fade/rewind behaviour
  private pauseFadeTime = 0.5;    // 500ms fade
  private resumeRewindTime = 1.0; // 1s rewind on resume
  
  // Duck settings
  private duckRampTime = 1.0;     // 1000ms fade for duck
  private duckEqFreq = 4000;      // 4kHz center frequency
  private duckEqGain = -12;       // -12dB cut when ducked
  private duckEqQ = 1;            // Q factor
  private isDucked: boolean = false;
  private targetBpm: number = 120;
  
  private mixStartTime: number = 0;
  private mixDuration: number = 0;
  private schedulerInterval: number | null = null;
  private pendingMixTime: number | null = null; // Scheduled time to start mix
  private forceImmediateMix: boolean = false;   // True when triple-click triggers instant mix
  private autoAdvanceRequested: boolean = false; // Prevents repeated auto-advance callbacks
  private preparingQueueItem: boolean = false;   // True while async track load is in progress

  async init(): Promise<void> {
    if (this.audioContext) return;
    
    this.audioContext = new AudioContext();
    
    // Create duck EQ filter (peaking filter for mid-frequency cut)
    this.duckFilter = this.audioContext.createBiquadFilter();
    this.duckFilter.type = 'peaking';
    this.duckFilter.frequency.value = this.duckEqFreq;
    this.duckFilter.Q.value = this.duckEqQ;
    this.duckFilter.gain.value = 0; // Start with no EQ cut
    
    // Create master gain and connect: filter -> gain -> destination
    this.masterGain = this.audioContext.createGain();
    this.duckFilter.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);
    
    // Decks connect to the duck filter (not directly to master gain)
    this.deckA = new Deck(this.audioContext, this.duckFilter);
    this.deckB = new Deck(this.audioContext, this.duckFilter);
    
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
    const now = this.audioContext.currentTime;
    
    // --- Auto-advance: request next track when queue empties while playing ---
    if (this.phase === 'playing' && this.queue.length === 0 && !this.activeQueueItem && !this.preparingQueueItem) {
      if (!this.autoAdvanceRequested && this.onTrackEnded) {
        this.autoAdvanceRequested = true;
        this.onTrackEnded();
      }
      // If track finished and still nothing queued, go idle
      if (activeDeck?.isFinished()) {
        this.phase = 'idle';
      }
    }
    
    // --- Handle mixing phase (crossfade in progress) ---
    if (this.phase === 'mixing' && this.mixDuration > 0) {
      const elapsed = now - this.mixStartTime;
      const progress = Math.min(elapsed / this.mixDuration, 1);
      
      // Equal-power crossfade
      const outVolume = Math.cos(progress * Math.PI / 2);
      const inVolume = Math.sin(progress * Math.PI / 2);
      
      activeDeck?.setVolume(outVolume);
      inactiveDeck?.setVolume(inVolume);
      
      // Tempo slide: interpolate from current native to incoming native
      const currentNative = activeDeck?.getNativeBpm() ?? 120;
      const incomingNative = inactiveDeck?.getNativeBpm() ?? 120;
      const slidingBpm = currentNative + (incomingNative - currentNative) * progress;
      
      const outRate = slidingBpm / currentNative;
      const inRate = slidingBpm / incomingNative;
      
      activeDeck?.setPlaybackRate(outRate);
      inactiveDeck?.setPlaybackRate(inRate);
      
      this.targetBpm = slidingBpm;
      
      if (progress >= 1) {
        this.completeMix();
      }
    }
    
    // --- Handle queued track: schedule mix at the right moment ---
    if (this.phase === 'queued' && activeDeck?.isPlaying()) {
      if (this.pendingMixTime === null) {
        const currentTime = activeDeck.getCurrentTime();
        const rate = activeDeck.getPlaybackRate() || 1;
        
        if (this.forceImmediateMix) {
          // Triple-click: mix at the next downbeat (immediate)
          const beatMap = activeDeck.getBeatMap();
          if (beatMap) {
            const nextDownbeat = getNextDownbeat(beatMap, currentTime, activeDeck.getEffectiveBpm());
            const bufferDelta = nextDownbeat.timeSeconds - currentTime;
            this.pendingMixTime = now + bufferDelta / rate;
            console.log(`[DualDeck] Immediate mix at next downbeat in ${(bufferDelta / rate).toFixed(2)}s`);
          } else {
            this.pendingMixTime = now + 0.1;
          }
        } else {
          // Normal queue: mix 2 bars before the end of the current track
          const duration = activeDeck.getDuration();
          const nativeBpm = activeDeck.getNativeBpm();
          const beatMap = activeDeck.getBeatMap();
          const beatsPerBar = beatMap?.timeSignature.numerator ?? 4;
          const barDurationBuffer = beatsPerBar * (60 / nativeBpm); // bar duration in buffer-time
          const twoBars = 2 * barDurationBuffer;
          const mixStartTrackTime = Math.max(0, duration - twoBars);
          
          if (currentTime >= mixStartTrackTime - 0.05) {
            // Already at/past the mix point — start at next downbeat
            if (beatMap) {
              const nextDownbeat = getNextDownbeat(beatMap, currentTime, activeDeck.getEffectiveBpm());
              const bufferDelta = nextDownbeat.timeSeconds - currentTime;
              this.pendingMixTime = now + bufferDelta / rate;
            } else {
              this.pendingMixTime = now + 0.1;
            }
            console.log(`[DualDeck] Track near end — mix starting shortly`);
          } else {
            // Schedule mix 2 bars before end
            const bufferDelta = mixStartTrackTime - currentTime;
            this.pendingMixTime = now + bufferDelta / rate;
            console.log(`[DualDeck] Mix scheduled ${(bufferDelta / rate).toFixed(1)}s from now (2 bars before end)`);
          }
        }
      }
      
      // Check if it's time to start the mix
      if (this.pendingMixTime !== null && now >= this.pendingMixTime - 0.01) {
        console.log('[DualDeck] Starting mix now');
        this.pendingMixTime = null;
        this.forceImmediateMix = false;
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
    
    // CUT mode: 50ms micro-fade immediate switch
    if (this.config.transitionMode === 'cut') {
      this.executeCut(activeDeck, inactiveDeck);
      return;
    }
    
    // MIX mode: 2-bar quantised crossfade with tempo slide
    // Start incoming at current track's tempo (will slide during mix)
    const currentRate = activeDeck.getNativeBpm() / inactiveDeck.getNativeBpm();
    inactiveDeck.setPlaybackRate(currentRate);
    
    // Calculate mix duration: 2 bars
    const beatMap = activeDeck.getBeatMap();
    const bpm = activeDeck.getEffectiveBpm();
    const beatsPerBar = beatMap?.timeSignature.numerator ?? 4;
    const barDuration = (60 / bpm) * beatsPerBar;
    const mixBars = 2;
    this.mixDuration = barDuration * mixBars;
    
    console.log(`[DualDeck] MIX starting: ${mixBars} bars = ${this.mixDuration.toFixed(2)}s at ${bpm.toFixed(1)} BPM`);
    this.mixStartTime = this.audioContext.currentTime;
    
    // Start incoming deck at zero volume for crossfade
    inactiveDeck.setVolume(0);
    inactiveDeck.play(0);
    inactiveDeck.setState('fading-in');
    activeDeck.setState('fading-out');
    
    this.phase = 'mixing';
    console.log(`[DualDeck] Phase -> mixing, incoming track: ${this.activeQueueItem.track.name}`);
  }

  /** Execute bar-aligned CUT transition with 50ms micro-fade */
  private executeCut(activeDeck: Deck, inactiveDeck: Deck): void {
    if (!this.activeQueueItem || !this.audioContext) return;
    
    const incomingNativeBpm = inactiveDeck.getNativeBpm();
    
    // 50ms micro-fade to avoid click
    const fadeTime = 0.05;
    activeDeck.setVolume(0, fadeTime);
    
    // CUT mode: native tempo by default, unless Fix Tempo is ON
    if (this.config.fixTempo) {
      // Fix Tempo ON: match target BPM
      const playbackRate = this.targetBpm / incomingNativeBpm;
      inactiveDeck.setPlaybackRate(playbackRate);
      console.log(`[DualDeck] CUT to: ${this.activeQueueItem.track.name} (fixed at ${this.targetBpm.toFixed(1)} BPM)`);
    } else {
      // Fix Tempo OFF: play at native speed
      inactiveDeck.setPlaybackRate(1);
      this.targetBpm = incomingNativeBpm; // Update target to reflect native BPM
      console.log(`[DualDeck] CUT to: ${this.activeQueueItem.track.name} (native ${incomingNativeBpm.toFixed(1)} BPM)`);
    }
    
    inactiveDeck.setVolume(1);
    inactiveDeck.play(0);
    inactiveDeck.setState('playing');
    
    // Stop outgoing after micro-fade
    setTimeout(() => {
      activeDeck.stop();
      activeDeck.setVolume(1);
    }, fadeTime * 1000);
    
    // Swap active deck
    this.activeDeck = this.activeDeck === 'A' ? 'B' : 'A';
    this.phase = 'playing';
    this.forceImmediateMix = false;
    this.autoAdvanceRequested = false;
    this.activeQueueItem = null;
    this.advanceQueue();
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
    
    // Update target BPM to new track's native BPM
    this.targetBpm = this.getActiveDeck()?.getNativeBpm() ?? 120;
    
    this.phase = 'playing';
    this.forceImmediateMix = false;
    this.autoAdvanceRequested = false; // Allow auto-advance for the new track
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
    if (this.preparingQueueItem) return; // prevent concurrent preparations
    this.preparingQueueItem = true;
    
    const inactiveDeck = this.getInactiveDeck();
    if (!inactiveDeck) {
      this.preparingQueueItem = false;
      return;
    }
    
    try {
      await inactiveDeck.loadTrack(item.track);
      this.activeQueueItem = item;
      this.pendingMixTime = null;
      this.phase = 'queued';
      console.log(`[DualDeck] Next track ready: ${item.track.name}`);
    } finally {
      this.preparingQueueItem = false;
    }
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
    
    // Play at native BPM (no stretching on initial play)
    deck.setPlaybackRate(1);
    this.targetBpm = getNativeBpm(track.beatMap);
    
    // Start at zero volume with quick fade-in to mask SoundTouch startup artifacts
    deck.setVolume(0);
    deck.play(0);
    deck.setVolume(1, 0.05); // 50ms fade-in
    this.phase = 'playing';
  }

  /** Add a track to the end or front of the queue */
  addToQueue(track: Track, position: 'end' | 'next' = 'end'): void {
    
    const queueItem: QueueItem = {
      id: `q-${++this.queueIdCounter}`,
      track,
      settings: {
        transitionMode: this.config.transitionMode,
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

  /**
   * Triple-click: immediate 2-bar mix into the given track.
   * Preserves the existing queue — the interrupted activeQueueItem
   * is pushed back to the front so the queue resumes after.
   */
  async mixTrackImmediately(track: Track): Promise<void> {
    if (!this.audioContext) await this.init();
    this.autoAdvanceRequested = false;
    
    const activeDeck = this.getActiveDeck();
    if (!activeDeck?.isPlaying()) {
      // Nothing playing — just start immediately
      await this.playTrackImmediately(track);
      return;
    }
    
    // Preserve current activeQueueItem by pushing it back to front of queue
    if (this.activeQueueItem) {
      this.queue.unshift(this.activeQueueItem);
      this.activeQueueItem = null;
    }
    
    const queueItem: QueueItem = {
      id: `q-${++this.queueIdCounter}`,
      track,
      settings: {
        transitionMode: this.config.transitionMode,
        targetBpm: this.targetBpm,
      },
      queuedAt: Date.now(),
    };
    
    await this.prepareQueueItem(queueItem);
    this.forceImmediateMix = true;
    console.log(`[DualDeck] Immediate mix queued: ${track.name} (queue preserved, ${this.queue.length} remaining)`);
  }

  /** Queue a track for immediate transition (used by loadAndPlayTrack) */
  async queueTrack(track: Track): Promise<void> {
    this.autoAdvanceRequested = false;
    
    // Preserve current activeQueueItem by pushing it back to front of queue
    if (this.activeQueueItem) {
      this.queue.unshift(this.activeQueueItem);
      this.activeQueueItem = null;
    }
    
    const queueItem: QueueItem = {
      id: `q-${++this.queueIdCounter}`,
      track,
      settings: {
        transitionMode: this.config.transitionMode,
        targetBpm: this.targetBpm,
      },
      queuedAt: Date.now(),
    };
    
    await this.prepareQueueItem(queueItem);
    this.forceImmediateMix = true;
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

  /** Reorder queue items (drag-and-drop) */
  reorderQueue(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.queue.length) return;
    if (toIndex < 0 || toIndex >= this.queue.length) return;
    if (fromIndex === toIndex) return;
    
    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);
    console.log(`[DualDeck] Queue reordered: moved "${item.track.name}" from ${fromIndex} to ${toIndex}`);
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
    this.forceImmediateMix = false;
    this.autoAdvanceRequested = false;
    this.preparingQueueItem = false;
    console.log('[DualDeck] Stopped');
  }

  setDuck(enabled: boolean): void {
    if (!this.masterGain || !this.duckFilter || !this.audioContext) return;
    
    this.isDucked = enabled;
    const targetGain = enabled ? this.config.duckLevel : 1;
    const targetEqGain = enabled ? this.duckEqGain : 0;
    const timeConstant = this.duckRampTime / 3; // setTargetAtTime uses time constant
    
    // Ramp volume down/up over 1000ms
    this.masterGain.gain.setTargetAtTime(
      targetGain,
      this.audioContext.currentTime,
      timeConstant
    );
    
    // Ramp EQ cut in/out over 1000ms
    this.duckFilter.gain.setTargetAtTime(
      targetEqGain,
      this.audioContext.currentTime,
      timeConstant
    );
    
    console.log(`[DualDeck] Duck ${enabled ? 'ON' : 'OFF'}: volume=${targetGain}, EQ=${targetEqGain}dB`);
  }

  setTargetBpm(bpm: number): void {
    this.targetBpm = Math.max(60, Math.min(200, bpm));
  }

  setConfig(config: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Register a callback for when a track ends with nothing queued (auto-advance) */
  setOnTrackEnded(callback: OnTrackEndedCallback | null): void {
    this.onTrackEnded = callback;
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
      transitionMode: this.config.transitionMode,
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

  getFixTempo(): boolean {
    return this.config.fixTempo;
  }

  setFixTempo(enabled: boolean): void {
    this.config.fixTempo = enabled;
    console.log(`[DualDeck] Fix Tempo ${enabled ? 'ON' : 'OFF'}`);
    
    // If currently playing and fixTempo just turned on, apply tempo to current track
    const activeDeck = this.getActiveDeck();
    if (enabled && activeDeck?.isPlaying()) {
      const nativeBpm = activeDeck.getNativeBpm();
      const playbackRate = this.targetBpm / nativeBpm;
      activeDeck.setPlaybackRate(playbackRate);
      console.log(`[DualDeck] Applied tempo ${this.targetBpm.toFixed(1)} BPM (rate: ${playbackRate.toFixed(3)})`);
    } else if (!enabled && activeDeck?.isPlaying()) {
      // Fix Tempo OFF: revert to native speed
      activeDeck.setPlaybackRate(1);
      this.targetBpm = activeDeck.getNativeBpm();
      console.log(`[DualDeck] Reverted to native ${this.targetBpm.toFixed(1)} BPM`);
    }
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /** Global pause with 0.5s fade-down */
  pause(): void {
    const activeDeck = this.getActiveDeck();
    if (!activeDeck?.isPlaying() || !this.audioContext) return;
    
    // Fade down over 0.5s then pause
    activeDeck.setVolume(0, this.pauseFadeTime);
    setTimeout(() => {
      activeDeck.pause();
      activeDeck.setVolume(1); // Reset volume for resume
      console.log('[DualDeck] Paused with fade');
    }, this.pauseFadeTime * 1000);
  }

  /** Resume with 1s rewind and 0.5s fade-up */
  resumePlayback(): void {
    const activeDeck = this.getActiveDeck();
    if (!activeDeck?.isPaused()) return;
    
    // Rewind 1s (clamped to 0)
    const currentPos = activeDeck.getCurrentTime();
    const rewindPos = Math.max(0, currentPos - this.resumeRewindTime);
    
    // Start at zero volume and fade up
    activeDeck.setVolume(0);
    activeDeck.resume(rewindPos);
    activeDeck.setVolume(1, this.pauseFadeTime);
    console.log(`[DualDeck] Resumed from ${rewindPos.toFixed(2)}s with fade`);
  }

  togglePause(): void {
    const activeDeck = this.getActiveDeck();
    if (activeDeck?.isPaused()) {
      this.resumePlayback();
    } else if (activeDeck?.isPlaying()) {
      this.pause();
    }
  }

  /** Trigger next queued track transition immediately (one track only) */
  triggerNext(): void {
    if (this.phase === 'queued' && this.activeQueueItem) {
      // Track already prepared — start the mix now
      this.pendingMixTime = null;
      this.forceImmediateMix = false;
      this.startMix();
      console.log('[DualDeck] Next triggered manually');
    } else if (this.queue.length > 0) {
      // Nothing prepared yet — prepare next item and mix at next downbeat
      this.forceImmediateMix = true;
      this.advanceQueue();
      console.log('[DualDeck] Next: preparing next track, will mix at next downbeat');
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
