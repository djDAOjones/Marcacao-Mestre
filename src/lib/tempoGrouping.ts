import type { Track } from '../types';
import { getNativeBpm } from './beatScheduler';

/** A row of tracks grouped by a BPM range */
export interface TempoRow {
  /** Human-readable label, e.g. "80–96 BPM" */
  label: string;
  /** Lower bound of this row's BPM range (inclusive) */
  minBpm: number;
  /** Upper bound of this row's BPM range (inclusive) */
  maxBpm: number;
  /** Tracks within this BPM range, sorted by BPM ascending */
  tracks: Track[];
}

/**
 * Groups tracks into rows based on native BPM.
 * Each row spans an equal slice of the total BPM range.
 * Empty rows are omitted. Rows are ordered slowest → fastest.
 *
 * @param tracks   - All tracks in the library
 * @param rowCount - Number of tempo buckets (default 5)
 * @returns Array of TempoRow, slowest first
 */
export function groupTracksByTempo(tracks: Track[], rowCount: number = 5): TempoRow[] {
  if (tracks.length === 0) return [];

  const count = Math.max(1, Math.round(rowCount));

  // Compute native BPM for each track
  const withBpm = tracks.map(track => ({
    track,
    bpm: getNativeBpm(track.beatMap),
  }));

  const bpmValues = withBpm.map(t => t.bpm);
  const minBpm = Math.min(...bpmValues);
  const maxBpm = Math.max(...bpmValues);

  // Edge case: all tracks have the same BPM → single row
  if (maxBpm - minBpm < 1) {
    return [{
      label: `${Math.round(minBpm)} BPM`,
      minBpm,
      maxBpm,
      tracks: withBpm
        .sort((a, b) => a.track.name.localeCompare(b.track.name))
        .map(t => t.track),
    }];
  }

  const range = maxBpm - minBpm;
  const bucketSize = range / count;

  // Initialise empty buckets
  const buckets: { minBpm: number; maxBpm: number; tracks: typeof withBpm }[] = [];
  for (let i = 0; i < count; i++) {
    const lo = minBpm + i * bucketSize;
    const hi = i === count - 1 ? maxBpm : minBpm + (i + 1) * bucketSize;
    buckets.push({ minBpm: lo, maxBpm: hi, tracks: [] });
  }

  // Assign tracks to buckets
  for (const item of withBpm) {
    const index = Math.min(
      Math.floor((item.bpm - minBpm) / bucketSize),
      count - 1
    );
    buckets[index].tracks.push(item);
  }

  // Convert to TempoRow, omit empty buckets, sort tracks within each row by BPM
  return buckets
    .filter(b => b.tracks.length > 0)
    .map(b => ({
      label: `${Math.round(b.minBpm)}–${Math.round(b.maxBpm)} BPM`,
      minBpm: b.minBpm,
      maxBpm: b.maxBpm,
      tracks: b.tracks
        .sort((a, c) => a.bpm - c.bpm)
        .map(t => t.track),
    }));
}

/**
 * Returns the native BPM for a given track (convenience re-export).
 */
export function getTrackBpm(track: Track): number {
  return getNativeBpm(track.beatMap);
}
