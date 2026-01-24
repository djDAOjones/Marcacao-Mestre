import JSZip from 'jszip';
import { parseMidi } from './midiParser';
import type { Manifest, Track, Library } from '../types';

export interface LoadResult {
  library: Library;
  tracks: Track[];
}

export async function loadZipLibrary(file: File): Promise<LoadResult> {
  const zip = await JSZip.loadAsync(file);
  
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Missing manifest.json in ZIP file');
  }
  
  const manifestText = await manifestFile.async('string');
  const manifest: Manifest = JSON.parse(manifestText);
  
  if (!manifest.name || !manifest.tracks || !Array.isArray(manifest.tracks)) {
    throw new Error('Invalid manifest.json format');
  }
  
  const tracks: Track[] = [];
  
  for (const trackInfo of manifest.tracks) {
    const audioFile = zip.file(trackInfo.audio);
    const beatmapFile = zip.file(trackInfo.beatmap);
    
    if (!audioFile) {
      throw new Error(`Missing audio file: ${trackInfo.audio}`);
    }
    if (!beatmapFile) {
      throw new Error(`Missing beatmap file: ${trackInfo.beatmap}`);
    }
    
    const audioBlob = await audioFile.async('blob');
    const beatmapBuffer = await beatmapFile.async('arraybuffer');
    const beatMap = parseMidi(beatmapBuffer);
    
    const duration = await getAudioDuration(audioBlob);
    
    tracks.push({
      id: trackInfo.id,
      name: trackInfo.name,
      audioBlob: new Blob([audioBlob], { type: 'audio/mpeg' }),
      beatMap,
      duration,
    });
  }
  
  const library: Library = {
    id: crypto.randomUUID(),
    name: manifest.name,
    gridColumns: manifest.grid?.columns ?? 4,
    trackIds: tracks.map(t => t.id),
    uploadedAt: new Date(),
  };
  
  return { library, tracks };
}

async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error('Failed to load audio file'));
    };
    
    audio.src = URL.createObjectURL(blob);
  });
}
