export interface TempoEvent {
  tick: number;
  bpm: number;
  timeSeconds: number;
}

export interface BeatMap {
  timeSignature: { numerator: number; denominator: number };
  tempoEvents: TempoEvent[];
  ticksPerBeat: number;
}

export interface Track {
  id: string;
  name: string;
  audioBlob: Blob;
  beatMap: BeatMap;
  duration: number;
}

export interface Library {
  id: string;
  name: string;
  gridColumns: number;
  trackIds: string[];
  uploadedAt: Date;
}

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

export type TrackState = 'idle' | 'queued' | 'playing' | 'mixing-out' | 'mixing-in' | 'disabled';

export type PlaybackStatus = 'stopped' | 'playing' | 'queued' | 'mixing';

export interface TransportState {
  status: PlaybackStatus;
  currentTrackId: string | null;
  nextTrackId: string | null;
  currentBpm: number;
  mixProgress: number;
  mixLengthBars: number;
}

/**
 * Transition modes (v4 simplified):
 * - 'mix': 2-bar quantised crossfade with tempo slide
 * - 'cut': Immediate switch with 50ms micro-fade (non-quantised)
 */
export type TransitionMode = 'mix' | 'cut';

/** Settings snapshot captured when a track is queued */
export interface QueueItemSettings {
  transitionMode: TransitionMode;
  targetBpm: number;
}

/** A track in the queue with its transition settings */
export interface QueueItem {
  id: string;           // Unique queue item ID (not track ID)
  track: Track;
  settings: QueueItemSettings;
  queuedAt: number;     // Timestamp for ordering
}

export interface AppSettings {
  transitionMode: TransitionMode;
  duckOn: boolean;
  duckLevel: number;
}
