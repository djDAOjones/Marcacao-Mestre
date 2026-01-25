declare module 'soundtouchjs' {
  export class PitchShifter {
    constructor(audioContext: AudioContext, audioBuffer: AudioBuffer, bufferSize?: number);
    
    tempo: number;
    pitch: number;
    rate: number;
    percentagePlayed: number;
    
    connect(destination: AudioNode): void;
    disconnect(): void;
    
    on(event: 'play', callback: (detail: unknown) => void): void;
  }
}
