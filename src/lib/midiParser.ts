import type { BeatMap, TempoEvent } from '../types';

const MICROSECONDS_PER_MINUTE = 60_000_000;

interface MidiHeader {
  format: number;
  tracks: number;
  ticksPerBeat: number;
}

interface MidiEvent {
  deltaTime: number;
  type: number;
  metaType?: number;
  data?: number[];
}

interface MidiTrack {
  events: MidiEvent[];
}

export function parseMidi(arrayBuffer: ArrayBuffer): BeatMap {
  const data = new DataView(arrayBuffer);
  let offset = 0;

  const header = parseHeader(data, offset);
  offset += 14;

  const tempoEvents: TempoEvent[] = [];
  let timeSignature = { numerator: 4, denominator: 4 };
  
  for (let i = 0; i < header.tracks; i++) {
    const track = parseTrack(data, offset);
    offset += 8 + getTrackLength(data, offset - 8 + 4);
    
    let absoluteTick = 0;
    let absoluteTime = 0;
    let currentTempo = 500000;
    
    for (const event of track.events) {
      absoluteTick += event.deltaTime;
      
      const tickDuration = (currentTempo / MICROSECONDS_PER_MINUTE) / header.ticksPerBeat * 60;
      absoluteTime += event.deltaTime * tickDuration;
      
      if (event.type === 0xFF) {
        if (event.metaType === 0x51 && event.data) {
          currentTempo = (event.data[0] << 16) | (event.data[1] << 8) | event.data[2];
          const bpm = MICROSECONDS_PER_MINUTE / currentTempo;
          tempoEvents.push({
            tick: absoluteTick,
            bpm: Math.round(bpm * 100) / 100,
            timeSeconds: absoluteTime,
          });
        }
        
        if (event.metaType === 0x58 && event.data) {
          timeSignature = {
            numerator: event.data[0],
            denominator: Math.pow(2, event.data[1]),
          };
        }
      }
    }
  }

  if (tempoEvents.length === 0) {
    tempoEvents.push({ tick: 0, bpm: 120, timeSeconds: 0 });
  }

  return {
    timeSignature,
    tempoEvents,
    ticksPerBeat: header.ticksPerBeat,
  };
}

function parseHeader(data: DataView, offset: number): MidiHeader {
  const chunkType = String.fromCharCode(
    data.getUint8(offset),
    data.getUint8(offset + 1),
    data.getUint8(offset + 2),
    data.getUint8(offset + 3)
  );
  
  if (chunkType !== 'MThd') {
    throw new Error('Invalid MIDI file: missing MThd header');
  }
  
  return {
    format: data.getUint16(offset + 8),
    tracks: data.getUint16(offset + 10),
    ticksPerBeat: data.getUint16(offset + 12),
  };
}

function getTrackLength(data: DataView, offset: number): number {
  return data.getUint32(offset);
}

function parseTrack(data: DataView, offset: number): MidiTrack {
  const chunkType = String.fromCharCode(
    data.getUint8(offset),
    data.getUint8(offset + 1),
    data.getUint8(offset + 2),
    data.getUint8(offset + 3)
  );
  
  if (chunkType !== 'MTrk') {
    throw new Error('Invalid MIDI file: missing MTrk header');
  }
  
  const length = data.getUint32(offset + 4);
  const events: MidiEvent[] = [];
  let pos = offset + 8;
  const endPos = pos + length;
  
  while (pos < endPos) {
    const { value: deltaTime, bytesRead: deltaBytes } = readVariableLength(data, pos);
    pos += deltaBytes;
    
    const eventType = data.getUint8(pos);
    pos++;
    
    const event: MidiEvent = { deltaTime, type: eventType };
    
    if (eventType === 0xFF) {
      event.metaType = data.getUint8(pos);
      pos++;
      const { value: metaLength, bytesRead: metaBytes } = readVariableLength(data, pos);
      pos += metaBytes;
      
      if (metaLength > 0) {
        event.data = [];
        for (let i = 0; i < metaLength; i++) {
          event.data.push(data.getUint8(pos + i));
        }
      }
      pos += metaLength;
    } else if (eventType === 0xF0 || eventType === 0xF7) {
      const { value: sysexLength, bytesRead: sysexBytes } = readVariableLength(data, pos);
      pos += sysexBytes + sysexLength;
    } else {
      const messageType = eventType & 0xF0;
      if (messageType === 0x80 || messageType === 0x90 || messageType === 0xA0 || 
          messageType === 0xB0 || messageType === 0xE0) {
        pos += 2;
      } else if (messageType === 0xC0 || messageType === 0xD0) {
        pos += 1;
      }
    }
    
    events.push(event);
  }
  
  return { events };
}

function readVariableLength(data: DataView, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let bytesRead = 0;
  let byte: number;
  
  do {
    byte = data.getUint8(offset + bytesRead);
    value = (value << 7) | (byte & 0x7F);
    bytesRead++;
  } while (byte & 0x80);
  
  return { value, bytesRead };
}

export function getBpmAtTime(beatMap: BeatMap, timeSeconds: number): number {
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

export function getBarDuration(beatMap: BeatMap, bpm: number): number {
  const beatsPerBar = beatMap.timeSignature.numerator;
  const secondsPerBeat = 60 / bpm;
  return beatsPerBar * secondsPerBeat;
}
