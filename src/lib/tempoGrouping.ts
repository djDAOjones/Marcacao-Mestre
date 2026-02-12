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
 * Groups tracks into rows with roughly equal track counts per row.
 *
 * Algorithm:
 *   1. Sort all tracks by native BPM ascending.
 *   2. Split the sorted list into `rowCount` groups of ⌈N/rowCount⌉ tracks.
 *   3. Derive each row's BPM label from the actual min/max BPM in that group.
 *
 * This ensures consistent button density across rows regardless of the BPM
 * distribution of the uploaded library.
 *
 * @param tracks   - All tracks in the library
 * @param rowCount - Number of tempo rows to create (default 5)
 * @returns Array of TempoRow, slowest first
 */
export function groupTracksByTempo(tracks: Track[], rowCount: number = 5): TempoRow[] {
  if (tracks.length === 0) return [];

  const count = Math.max(1, Math.round(rowCount));

  // Sort all tracks by native BPM ascending
  const sorted = tracks
    .map(track => ({ track, bpm: getNativeBpm(track.beatMap) }))
    .sort((a, b) => a.bpm - b.bpm);

  // Edge case: all tracks have the same BPM → single row
  if (sorted[sorted.length - 1].bpm - sorted[0].bpm < 1) {
    return [{
      label: `${Math.round(sorted[0].bpm)} BPM`,
      minBpm: sorted[0].bpm,
      maxBpm: sorted[sorted.length - 1].bpm,
      tracks: sorted.map(t => t.track),
    }];
  }

  // Split into roughly equal-sized groups
  const rows: TempoRow[] = [];
  const perRow = Math.ceil(sorted.length / count);

  for (let i = 0; i < count; i++) {
    const start = i * perRow;
    const end = Math.min(start + perRow, sorted.length);
    if (start >= sorted.length) break; // fewer tracks than rows

    const group = sorted.slice(start, end);
    const minBpm = group[0].bpm;
    const maxBpm = group[group.length - 1].bpm;

    rows.push({
      label: Math.round(minBpm) === Math.round(maxBpm)
        ? `${Math.round(minBpm)} BPM`
        : `${Math.round(minBpm)}–${Math.round(maxBpm)} BPM`,
      minBpm,
      maxBpm,
      tracks: group.map(t => t.track),
    });
  }

  return rows;
}

/**
 * Returns the native BPM for a given track (convenience re-export).
 */
export function getTrackBpm(track: Track): number {
  return getNativeBpm(track.beatMap);
}
