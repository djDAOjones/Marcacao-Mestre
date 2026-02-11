/**
 * beatScheduler — Pure utility functions for beat/bar math.
 *
 * All functions are stateless and derive timing from a BeatMap. Used by
 * DualDeckEngine for mix scheduling and by Deck for beat-position display.
 */

import type { BeatMap } from '../types';

/** Current position within the beat grid (bar, beat, fraction) */
export interface BeatPosition {
  bar: number;
  beat: number;
  /** Sub-beat fraction 0–1 (0 = on-beat, 0.5 = mid-beat) */
  fraction: number;
  timeSeconds: number;
}

/** Information about the next downbeat (bar line) */
export interface DownbeatInfo {
  timeSeconds: number;
  bar: number;
}

/**
 * Calculate the beat position (bar, beat, fraction) at a given time.
 *
 * @param beatMap       - Track's beat map
 * @param timeSeconds   - Current playback position in seconds
 * @param effectiveBpm  - Override BPM (e.g. after tempo adjustment); falls back to map lookup
 */
export function getBeatPositionAtTime(
  beatMap: BeatMap,
  timeSeconds: number,
  effectiveBpm?: number
): BeatPosition {
  const bpm = effectiveBpm ?? getBpmAtTimeFromMap(beatMap, timeSeconds);
  const beatsPerBar = beatMap.timeSignature.numerator;
  const secondsPerBeat = 60 / bpm;
  
  const totalBeats = timeSeconds / secondsPerBeat;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beatInBar = (totalBeats % beatsPerBar);
  const beat = Math.floor(beatInBar) + 1;
  const fraction = beatInBar - Math.floor(beatInBar);
  
  return { bar, beat, fraction, timeSeconds };
}

/**
 * Find the next bar-line (downbeat) after the given time.
 * Used by the scheduler to quantise mix start points.
 */
export function getNextDownbeat(
  beatMap: BeatMap,
  currentTimeSeconds: number,
  effectiveBpm?: number
): DownbeatInfo {
  const bpm = effectiveBpm ?? getBpmAtTimeFromMap(beatMap, currentTimeSeconds);
  const beatsPerBar = beatMap.timeSignature.numerator;
  const secondsPerBeat = 60 / bpm;
  const barDuration = beatsPerBar * secondsPerBeat;
  
  const currentBar = Math.floor(currentTimeSeconds / barDuration);
  const nextBar = currentBar + 1;
  const nextDownbeatTime = nextBar * barDuration;
  
  return {
    timeSeconds: nextDownbeatTime,
    bar: nextBar + 1,
  };
}

/** Convenience: seconds remaining until the next downbeat */
export function getTimeUntilNextDownbeat(
  beatMap: BeatMap,
  currentTimeSeconds: number,
  effectiveBpm?: number
): number {
  const nextDownbeat = getNextDownbeat(beatMap, currentTimeSeconds, effectiveBpm);
  return nextDownbeat.timeSeconds - currentTimeSeconds;
}

/** Duration of one bar in seconds at the given BPM */
export function getBarDurationAtBpm(beatMap: BeatMap, bpm: number): number {
  const beatsPerBar = beatMap.timeSignature.numerator;
  const secondsPerBeat = 60 / bpm;
  return beatsPerBar * secondsPerBeat;
}

/** Look up the BPM at a given time by scanning tempo events (internal) */
function getBpmAtTimeFromMap(beatMap: BeatMap, timeSeconds: number): number {
  let bpm = beatMap.tempoEvents[0]?.bpm ?? 120;
  
  for (const event of beatMap.tempoEvents) {
    if (event.timeSeconds <= timeSeconds) {
      bpm = event.bpm;
    } else {
      break;
    }
  }
  
  return bpm;
}

/** Get the track's native BPM (first tempo event, default 120) */
export function getNativeBpm(beatMap: BeatMap): number {
  return beatMap.tempoEvents[0]?.bpm ?? 120;
}
