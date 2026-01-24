import Dexie, { type EntityTable } from 'dexie';
import type { Track, Library, BeatMap } from '../types';

interface TrackRecord {
  id: string;
  name: string;
  audioBlob: Blob;
  beatMap: BeatMap;
  duration: number;
}

interface LibraryRecord {
  id: string;
  name: string;
  gridColumns: number;
  trackIds: string[];
  uploadedAt: Date;
}

const db = new Dexie('MarcacaoMestreDB') as Dexie & {
  tracks: EntityTable<TrackRecord, 'id'>;
  libraries: EntityTable<LibraryRecord, 'id'>;
};

db.version(1).stores({
  tracks: 'id, name',
  libraries: 'id, name, uploadedAt',
});

export async function saveLibrary(library: Library, tracks: Track[]): Promise<void> {
  await db.transaction('rw', db.tracks, db.libraries, async () => {
    for (const track of tracks) {
      await db.tracks.put(track);
    }
    await db.libraries.put({
      ...library,
      uploadedAt: new Date(),
    });
  });
}

export async function getLibrary(id: string): Promise<Library | undefined> {
  return db.libraries.get(id);
}

export async function getAllLibraries(): Promise<Library[]> {
  return db.libraries.toArray();
}

export async function getTrack(id: string): Promise<Track | undefined> {
  return db.tracks.get(id);
}

export async function getTracksForLibrary(trackIds: string[]): Promise<Track[]> {
  return db.tracks.where('id').anyOf(trackIds).toArray();
}

export async function deleteLibrary(id: string): Promise<void> {
  const library = await db.libraries.get(id);
  if (library) {
    await db.transaction('rw', db.tracks, db.libraries, async () => {
      await db.tracks.where('id').anyOf(library.trackIds).delete();
      await db.libraries.delete(id);
    });
  }
}

export { db };
