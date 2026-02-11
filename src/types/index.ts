// =============================================================================
// Audio & Beat Map
// =============================================================================

/** A single tempo-change event parsed from a MIDI beat map */
export interface TempoEvent {
  tick: number;
  bpm: number;
  timeSeconds: number;
}

/** Beat map extracted from MIDI — drives all scheduling and display */
export interface BeatMap {
  timeSignature: { numerator: number; denominator: number };
  tempoEvents: TempoEvent[];
  ticksPerBeat: number;
}

// =============================================================================
// Track & Library
// =============================================================================

/** A single audio track with its decoded audio and beat map */
export interface Track {
  id: string;
  name: string;
  audioBlob: Blob;
  beatMap: BeatMap;
  duration: number;
}

/** A collection of tracks loaded from a ZIP archive */
export interface Library {
  id: string;
  name: string;
  gridColumns: number;
  trackIds: string[];
  uploadedAt: Date;
}

/** ZIP manifest.json schema — describes tracks and grid layout */
export interface Manifest {
  name: string;
  grid: {
    columns: number;
  };
  tracks: Array<{
    id: string;
    name: string;
    audio: string;
    beatmap: string;
  }>;
}

// =============================================================================
// UI State
// =============================================================================

/** Visual state of a track button in the grid */
export type TrackState = 'idle' | 'queued' | 'playing' | 'mixing-out' | 'mixing-in' | 'disabled';

// =============================================================================
// Transition & Queue
// =============================================================================

/**
 * Transition modes:
 * - 'mix': 2-bar quantised crossfade with equal-power curve + tempo slide
 * - 'cut': Bar-aligned switch with 1-beat musical fade
 */
export type TransitionMode = 'mix' | 'cut';

/** Settings snapshot captured when a track is queued */
export interface QueueItemSettings {
  transitionMode: TransitionMode;
  targetBpm: number;
}

/** A track in the playback queue with its transition settings */
export interface QueueItem {
  /** Unique queue-item ID (not the same as Track.id) */
  id: string;
  track: Track;
  settings: QueueItemSettings;
  /** Date.now() timestamp when this item was queued */
  queuedAt: number;
}

// =============================================================================
// App Settings
// =============================================================================

/** Persistent app-level settings (controls in ControlBar) */
export interface AppSettings {
  transitionMode: TransitionMode;
  fixTempo: boolean;
  targetBpm: number;
  duckOn: boolean;
  duckLevel: number;
}
