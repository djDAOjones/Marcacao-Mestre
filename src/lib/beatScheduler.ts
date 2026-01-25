import type { BeatMap } from '../types';

export interface BeatPosition {
  bar: number;
  beat: number;
  fraction: number;
  timeSeconds: number;
}

export interface DownbeatInfo {
  timeSeconds: number;
  bar: number;
}

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

export function getTimeUntilNextDownbeat(
  beatMap: BeatMap,
  currentTimeSeconds: number,
  effectiveBpm?: number
): number {
  const nextDownbeat = getNextDownbeat(beatMap, currentTimeSeconds, effectiveBpm);
  return nextDownbeat.timeSeconds - currentTimeSeconds;
}

export function getBarDurationAtBpm(beatMap: BeatMap, bpm: number): number {
  const beatsPerBar = beatMap.timeSignature.numerator;
  const secondsPerBeat = 60 / bpm;
  return beatsPerBar * secondsPerBeat;
}

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

export function getNativeBpm(beatMap: BeatMap): number {
  return beatMap.tempoEvents[0]?.bpm ?? 120;
}
