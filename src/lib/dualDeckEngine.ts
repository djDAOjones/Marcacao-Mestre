/**
 * DualDeckEngine — Core audio playback orchestrator for Marcação Mestre.
 *
 * Architecture:
 *   DualDeckEngine  (this file)  — Orchestrator: audio init, scheduler, transitions, transport
 *   └─ QueueManager               — Queue CRUD (add/remove/reorder), no audio deps
 *   └─ Deck (×2)                  — Individual deck playback via SoundTouch
 *   └─ beatScheduler              — Pure beat/bar math utilities
 *
 * The engine manages two Deck instances (A/B) for gapless mixing. A scheduler
 * running on requestAnimationFrame handles auto-advance, mix timing, and
 * crossfade progression. Queue data is delegated to QueueManager.
 *
 * Transition modes:
 *   - 'mix'  — 2-bar quantised crossfade with equal-power curve + tempo slide
 *   - 'cut'  — Bar-aligned switch with 1-beat musical fade
 */

import type { Track, QueueItem, TransitionMode } from '../types';
import { Deck } from './deck';
import { QueueManager } from './queueManager';
import { getNextDownbeat, getNativeBpm, type BeatPosition } from './beatScheduler';

// =============================================================================
// Types
// =============================================================================

/** Lifecycle phase of the engine */
export type TransitionPhase = 'idle' | 'queued' | 'mixing' | 'playing';

/** Snapshot of engine state for React UI consumption (read-only) */
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

/** Engine configuration — controls transition behaviour and tempo */
export interface EngineConfig {
  transitionMode: TransitionMode;
  duckLevel: number;
  fixTempo: boolean;
}

type DeckId = 'A' | 'B';

/** Callback fired when the current track ends with nothing queued (triggers auto-advance) */
export type OnTrackEndedCallback = () => void;

class DualDeckEngine {
  // ===========================================================================
  // Audio infrastructure
  // ===========================================================================
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckFilter: BiquadFilterNode | null = null;

  // ===========================================================================
  // Decks
  // ===========================================================================
  private deckA: Deck | null = null;
  private deckB: Deck | null = null;
  private activeDeck: DeckId = 'A';

  // ===========================================================================
  // Queue (delegated to QueueManager)
  // ===========================================================================
  private queueManager = new QueueManager();
  private phase: TransitionPhase = 'idle';

  /** Callback fired when queue empties during playback (triggers auto-advance in App) */
  private onTrackEnded: OnTrackEndedCallback | null = null;

  // ===========================================================================
  // Configuration
  // ===========================================================================
  private config: EngineConfig = {
    transitionMode: 'mix',
    duckLevel: 0.18,
    fixTempo: false,
  };

  private targetBpm: number = 120;

  // ===========================================================================
  // Pause / resume constants
  // ===========================================================================
  private readonly pauseFadeTime = 0.5;    // 500ms volume fade on pause
  private readonly resumeRewindTime = 1.0; // 1s rewind on resume

  // ===========================================================================
  // Duck EQ constants
  // ===========================================================================
  private readonly duckRampTime = 1.0;     // 1s ramp for duck transitions
  private readonly duckEqFreq = 4000;      // 4 kHz center frequency
  private readonly duckEqGain = -12;       // –12 dB cut when ducked
  private readonly duckEqQ = 1;            // Q factor
  private isDucked: boolean = false;

  // ===========================================================================
  // Scheduler state
  // ===========================================================================
  private mixStartTime: number = 0;
  private mixDuration: number = 0;
  private schedulerInterval: number | null = null;
  /** AudioContext.currentTime when the next mix should start (null = not yet computed) */
  private pendingMixTime: number | null = null;
  /** When true, the scheduler picks the next downbeat instead of 2-bars-before-end */
  private forceImmediateMix: boolean = false;
  /** Prevents repeated auto-advance callbacks within one track lifecycle */
  private autoAdvanceRequested: boolean = false;
  /** Guards against concurrent async track loads in prepareQueueItem */
  private preparingQueueItem: boolean = false;
  /** Engine-level pause flag — gates the entire scheduler when true */
  private isPausedByUser: boolean = false;

  // ===========================================================================
  // Initialisation
  // ===========================================================================

  /** Initialise AudioContext, create audio graph, and start the scheduler */
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

  // ===========================================================================
  // Scheduler (runs every animation frame)
  // ===========================================================================

  private startScheduler(): void {
    if (this.schedulerInterval) return;
    
    const tick = () => {
      this.schedulerTick();
      this.schedulerInterval = requestAnimationFrame(tick);
    };
    tick();
  }

  /**
   * Core scheduler tick — runs on every requestAnimationFrame.
   * Handles three concerns:
   *   1. Auto-advance: fires onTrackEnded when queue empties
   *   2. Mixing: drives the equal-power crossfade + tempo slide
   *   3. Queue scheduling: computes when to start the next mix
   */
  private schedulerTick(): void {
    if (!this.audioContext) return;
    if (this.isPausedByUser) return; // Skip all scheduling while paused
    
    const activeDeck = this.getActiveDeck();
    const inactiveDeck = this.getInactiveDeck();
    const now = this.audioContext.currentTime;
    
    // --- Auto-advance: request next track when queue empties while playing ---
    if (this.phase === 'playing' && this.queueManager.length === 0 && !this.queueManager.getActiveItem() && !this.preparingQueueItem) {
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
          
          // Safety: don't schedule if duration looks invalid
          if (duration <= 0 || !Number.isFinite(duration) || !Number.isFinite(nativeBpm) || nativeBpm <= 0) {
            console.warn(`[DualDeck] Skipping mix schedule: invalid duration=${duration} or bpm=${nativeBpm}`);
            return;
          }
          
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
            console.log(`[DualDeck] Mix scheduled ${(bufferDelta / rate).toFixed(1)}s from now (2 bars before end, duration=${duration.toFixed(1)}s, currentTime=${currentTime.toFixed(1)}s)`);
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

  // ===========================================================================
  // Transition execution
  // ===========================================================================

  /** Begin a transition (MIX or CUT) to the prepared queue item */
  private startMix(): void {
    const activeDeck = this.getActiveDeck();
    const inactiveDeck = this.getInactiveDeck();
    
    if (!activeDeck || !inactiveDeck || !this.queueManager.getActiveItem() || !this.audioContext) {
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
    console.log(`[DualDeck] Phase -> mixing, incoming track: ${this.queueManager.getActiveItem()!.track.name}`);
  }

  /** Execute bar-aligned CUT transition with 1-beat musical fade */
  private executeCut(activeDeck: Deck, inactiveDeck: Deck): void {
    const activeItem = this.queueManager.getActiveItem();
    if (!activeItem || !this.audioContext) return;
    
    const incomingNativeBpm = inactiveDeck.getNativeBpm();
    
    // 1-beat fade-out on outgoing (musical, not jarring)
    const bpm = activeDeck.getEffectiveBpm() || 120;
    const beatDuration = 60 / bpm;
    activeDeck.setVolume(0, beatDuration);
    
    // CUT mode: native tempo by default, unless Fix Tempo is ON
    if (this.config.fixTempo) {
      const playbackRate = this.targetBpm / incomingNativeBpm;
      inactiveDeck.setPlaybackRate(playbackRate);
      console.log(`[DualDeck] CUT to: ${activeItem.track.name} (fixed at ${this.targetBpm.toFixed(1)} BPM, fade ${(beatDuration * 1000).toFixed(0)}ms)`);
    } else {
      inactiveDeck.setPlaybackRate(1);
      this.targetBpm = incomingNativeBpm;
      console.log(`[DualDeck] CUT to: ${activeItem.track.name} (native ${incomingNativeBpm.toFixed(1)} BPM, fade ${(beatDuration * 1000).toFixed(0)}ms)`);
    }
    
    // Incoming: start at zero, ramp to full in 20ms (click-free)
    inactiveDeck.setVolume(0);
    inactiveDeck.play(0);
    inactiveDeck.setVolume(1, 0.02);
    inactiveDeck.setState('playing');
    
    // Stop outgoing after the 1-beat fade completes
    setTimeout(() => {
      activeDeck.stop();
      activeDeck.setVolume(1);
    }, beatDuration * 1000 + 50);
    
    // Swap active deck
    this.activeDeck = this.activeDeck === 'A' ? 'B' : 'A';
    this.phase = 'playing';
    this.forceImmediateMix = false;
    this.autoAdvanceRequested = false;
    this.queueManager.clearActiveItem();
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
    this.queueManager.clearActiveItem();
    this.mixDuration = 0;
    this.advanceQueue();
  }

  /** Shift the next item from the queue and begin loading it into the inactive deck */
  private advanceQueue(): void {
    const nextItem = this.queueManager.shift();
    if (nextItem) {
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
      this.queueManager.setActiveItem(item);
      this.pendingMixTime = null;
      this.phase = 'queued';
      console.log(`[DualDeck] Next track ready: ${item.track.name}`);
    } finally {
      this.preparingQueueItem = false;
    }
  }

  // ===========================================================================
  // Public playback API
  // ===========================================================================

  /**
   * Main entry point: play a track immediately if idle, or queue for transition.
   * Called by App on single-click.
   */
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

  // ===========================================================================
  // Queue management (delegates to QueueManager)
  // ===========================================================================

  /** Add a track to the end or front of the queue */
  addToQueue(track: Track, position: 'end' | 'next' = 'end'): void {
    const config = { transitionMode: this.config.transitionMode, targetBpm: this.targetBpm };
    this.queueManager.add(track, position, config);
    console.log(`[DualDeck] Track added to queue (${position}): ${track.name}`);
    
    // If nothing is being prepared, start loading the first queued item
    if (!this.queueManager.getActiveItem() && this.phase === 'playing') {
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
    
    // Preserve current active item by pushing it back to front of queue
    this.preserveActiveItem();
    
    const config = { transitionMode: this.config.transitionMode, targetBpm: this.targetBpm };
    const queueItem = this.queueManager.createItem(track, config);
    await this.prepareQueueItem(queueItem);
    this.forceImmediateMix = true;
    console.log(`[DualDeck] Immediate mix queued: ${track.name} (queue preserved, ${this.queueManager.length} remaining)`);
  }

  /** Queue a track for immediate transition (used by loadAndPlayTrack) */
  async queueTrack(track: Track): Promise<void> {
    this.autoAdvanceRequested = false;
    this.preserveActiveItem();
    
    const config = { transitionMode: this.config.transitionMode, targetBpm: this.targetBpm };
    const queueItem = this.queueManager.createItem(track, config);
    await this.prepareQueueItem(queueItem);
    this.forceImmediateMix = true;
    console.log(`[DualDeck] Track queued for immediate transition: ${track.name}`);
  }

  /** Push the current active item back to the front of the queue (preserves queue on interrupt) */
  private preserveActiveItem(): void {
    const active = this.queueManager.getActiveItem();
    if (active) {
      this.queueManager.unshiftItem(active);
      this.queueManager.clearActiveItem();
    }
  }

  cancelQueue(): void {
    this.queueManager.clearActiveItem();
    if (this.phase === 'queued') {
      this.phase = 'playing';
    }
  }

  /** Remove an item from the queue by its ID */
  removeFromQueue(itemId: string): void {
    const removed = this.queueManager.remove(itemId);
    if (removed) {
      console.log(`[DualDeck] Removed from queue: ${removed.track.name}`);
    }
  }

  /** Reorder queue items (drag-and-drop) */
  reorderQueue(fromIndex: number, toIndex: number): void {
    this.queueManager.reorder(fromIndex, toIndex);
  }

  /** Get a copy of the current queue */
  getQueue(): QueueItem[] {
    return this.queueManager.getQueue();
  }

  /** Clear the queue and any pending preparation, without stopping current playback */
  clearQueue(): void {
    this.queueManager.clear();
    this.preparingQueueItem = false;
    this.pendingMixTime = null;
    this.forceImmediateMix = false;
    if (this.phase === 'queued') {
      this.phase = 'playing';
    }
    console.log('[DualDeck] Queue cleared');
  }

  // ===========================================================================
  // Transport controls
  // ===========================================================================

  /** Full stop — stops both decks, clears queue and all scheduler state */
  stop(): void {
    this.deckA?.stop();
    this.deckB?.stop();
    this.phase = 'idle';
    this.queueManager.clear();
    this.mixDuration = 0;
    this.pendingMixTime = null;
    this.forceImmediateMix = false;
    this.autoAdvanceRequested = false;
    this.preparingQueueItem = false;
    this.isPausedByUser = false;
    console.log('[DualDeck] Stopped');
  }

  // ===========================================================================
  // Duck / EQ
  // ===========================================================================

  /** Toggle duck mode (volume + EQ cut for voice-over) */
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

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /** Set target BPM (clamped 60–200) */
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

  // ===========================================================================
  // State getters (for React UI)
  // ===========================================================================

  /** Build a read-only transport state snapshot for React rendering */
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
      nextTrack: this.queueManager.getNextTrack(),
      queue: this.queueManager.getQueue(),
      currentBpm: activeDeck?.getEffectiveBpm() ?? this.targetBpm,
      targetBpm: this.targetBpm,
      mixProgress,
      transitionMode: this.config.transitionMode,
      beatPosition: activeDeck?.getStatus().beatPosition ?? null,
      isPaused: this.isPausedByUser,
    };
  }

  getCurrentTrack(): Track | null {
    return this.getActiveDeck()?.getTrack() ?? null;
  }

  getQueuedTrack(): Track | null {
    return this.queueManager.getNextTrack();
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

  /** Resume a suspended AudioContext (required by browsers after user gesture) */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /** Global pause — stops both decks immediately and gates scheduler */
  pause(): void {
    if (!this.audioContext) return;
    
    const activeDeck = this.getActiveDeck();
    const inactiveDeck = this.getInactiveDeck();
    
    // Nothing to pause
    if (!activeDeck?.isPlaying() && this.phase !== 'mixing') return;
    
    this.isPausedByUser = true;
    
    // Fade down and pause active deck
    activeDeck?.setVolume(0, this.pauseFadeTime);
    setTimeout(() => {
      if (activeDeck?.isPlaying()) {
        activeDeck.pause();
      }
      activeDeck?.setVolume(1); // Reset volume for resume
    }, this.pauseFadeTime * 1000);
    
    // Also pause inactive deck if it's playing (e.g. during mixing)
    if (inactiveDeck?.isPlaying()) {
      inactiveDeck.setVolume(0, this.pauseFadeTime);
      setTimeout(() => {
        if (inactiveDeck?.isPlaying()) {
          inactiveDeck.pause();
        }
        inactiveDeck?.setVolume(1);
      }, this.pauseFadeTime * 1000);
    }
    
    console.log('[DualDeck] Paused (engine-level)');
  }

  /** Resume with 1s rewind and 0.5s fade-up */
  resumePlayback(): void {
    const activeDeck = this.getActiveDeck();
    const inactiveDeck = this.getInactiveDeck();
    
    if (!activeDeck?.isPaused()) return;
    
    // Rewind 1s (clamped to 0)
    const currentPos = activeDeck.getCurrentTime();
    const rewindPos = Math.max(0, currentPos - this.resumeRewindTime);
    
    // Start at zero volume and fade up
    activeDeck.setVolume(0);
    activeDeck.resume(rewindPos);
    activeDeck.setVolume(1, this.pauseFadeTime);
    
    // Also resume inactive deck if it was paused (mid-mix pause)
    if (inactiveDeck?.isPaused()) {
      inactiveDeck.setVolume(0);
      inactiveDeck.resume();
      inactiveDeck.setVolume(1, this.pauseFadeTime);
    }
    
    this.isPausedByUser = false;
    console.log(`[DualDeck] Resumed from ${rewindPos.toFixed(2)}s with fade`);
  }

  togglePause(): void {
    if (this.isPausedByUser) {
      this.resumePlayback();
    } else {
      this.pause();
    }
  }

  /**
   * Rewind — restart the current track from the beginning.
   * If a mix is in progress, cancels it and restores the active deck.
   * Queue is preserved so playback continues normally after the restarted track.
   */
  rewind(): void {
    const activeDeck = this.getActiveDeck();
    if (!activeDeck?.getTrack()) return;

    // If mixing, cancel the mix: stop the incoming deck, restore active
    if (this.phase === 'mixing') {
      const inactiveDeck = this.getInactiveDeck();
      inactiveDeck?.stop();
      inactiveDeck?.setVolume(1);
      activeDeck.setVolume(1);
      activeDeck.setState('playing');
      this.mixDuration = 0;
    }

    // Restart from beginning with fade-in to mask SoundTouch artifacts
    activeDeck.setVolume(0);
    activeDeck.play(0);
    activeDeck.setVolume(1, 0.05);

    // Reset scheduler state but preserve queue
    this.phase = 'playing';
    this.pendingMixTime = null;
    this.forceImmediateMix = false;
    this.autoAdvanceRequested = false;
    this.isPausedByUser = false;

    // If there was an active queue item, re-prepare it (the inactive deck was potentially disrupted)
    const activeItem = this.queueManager.getActiveItem();
    if (activeItem) {
      this.queueManager.clearActiveItem();
      this.preparingQueueItem = false;
      this.prepareQueueItem(activeItem);
    }

    console.log(`[DualDeck] Rewind: restarted ${activeDeck.getTrack()?.name}`);
  }

  /** Trigger next queued track transition immediately (one track only) */
  triggerNext(): void {
    if (this.phase === 'queued' && this.queueManager.getActiveItem()) {
      // Track already prepared — start the mix now
      this.pendingMixTime = null;
      this.forceImmediateMix = false;
      this.startMix();
      console.log('[DualDeck] Next triggered manually');
    } else if (this.queueManager.length > 0) {
      // Nothing prepared yet — prepare next item and mix at next downbeat
      this.forceImmediateMix = true;
      this.advanceQueue();
      console.log('[DualDeck] Next: preparing next track, will mix at next downbeat');
    }
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  private getActiveDeck(): Deck | null {
    return this.activeDeck === 'A' ? this.deckA : this.deckB;
  }

  private getInactiveDeck(): Deck | null {
    return this.activeDeck === 'A' ? this.deckB : this.deckA;
  }
}

export const dualDeckEngine = new DualDeckEngine();
