import JSZip from 'jszip';
import { parseMidi } from './midiParser';
import type { Manifest, Track, Library } from '../types';

export interface LoadResult {
  library: Library;
  tracks: Track[];
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm'];
const MIDI_EXTENSION = '.mid';

/**
 * Auto-generates a manifest by finding paired audio + MIDI files with matching base names.
 * E.g., "E Capoeira E Capoeira.wav" pairs with "E Capoeira E Capoeira.mid"
 */
function generateManifestFromZip(zip: JSZip, zipFileName: string): Manifest {
  const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);
  
  // Find all MIDI files
  const midiFiles = files.filter(f => f.toLowerCase().endsWith(MIDI_EXTENSION));
  
  // Find paired audio files
  const trackInfos: Manifest['tracks'] = [];
  
  for (const midiFile of midiFiles) {
    const baseName = getBaseName(midiFile);
    
    // Look for matching audio file with same base name
    const audioFile = files.find(f => {
      const ext = getExtension(f).toLowerCase();
      return AUDIO_EXTENSIONS.includes(ext) && getBaseName(f) === baseName;
    });
    
    if (audioFile) {
      trackInfos.push({
        id: `track-${trackInfos.length + 1}`,
        name: baseName,
        audio: audioFile,
        beatmap: midiFile,
      });
    }
  }
  
  if (trackInfos.length === 0) {
    throw new Error(
      'No paired audio + MIDI files found. ' +
      'Make sure each .mid file has a matching audio file (.mp3, .wav, etc.) with the same name.'
    );
  }
  
  // Sort tracks alphabetically by name
  trackInfos.sort((a, b) => a.name.localeCompare(b.name));
  
  // Derive library name from ZIP filename
  const libraryName = zipFileName.replace(/\.zip$/i, '') || 'My Library';
  
  return {
    name: libraryName,
    grid: { columns: 4 },
    tracks: trackInfos,
  };
}

function getBaseName(filename: string): string {
  // Handle paths (e.g., "folder/track.mp3" -> "track")
  const name = filename.split('/').pop() || filename;
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(0, lastDot) : name;
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot) : '';
}

export async function loadZipLibrary(file: File): Promise<LoadResult> {
  const zip = await JSZip.loadAsync(file);
  
  let manifest: Manifest;
  
  const manifestFile = zip.file('manifest.json');
  if (manifestFile) {
    // Use existing manifest
    const manifestText = await manifestFile.async('string');
    manifest = JSON.parse(manifestText);
    
    if (!manifest.name || !manifest.tracks || !Array.isArray(manifest.tracks)) {
      throw new Error('Invalid manifest.json format');
    }
  } else {
    // Auto-generate manifest from paired audio/MIDI files
    manifest = generateManifestFromZip(zip, file.name);
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
