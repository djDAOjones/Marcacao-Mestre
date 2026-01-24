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

export interface AppSettings {
  quantiseOn: boolean;
  mixLengthBars: 4 | 8 | 16;
  duckOn: boolean;
  duckLevel: number;
}
