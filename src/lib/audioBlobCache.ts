/**
 * audioBlobCache.ts — IndexedDB-backed audio blob storage.
 *
 * Stores raw MP3 blobs on disk (IndexedDB) instead of keeping them all
 * in memory. Tracks are stored per-library, and blobs are retrieved on
 * demand when a track needs to be decoded for playback.
 *
 * This reduces memory from O(N × blobSize) to O(1) — only the blob
 * being decoded is in memory at any time. Critical for iPad 5's ~1 GB
 * Safari budget with 30+ track libraries (~120 MB of MP3 data).
 *
 * @module audioBlobCache
 */

// =============================================================================
// Constants
// =============================================================================

const DB_NAME = 'marcacao-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio-blobs';

// =============================================================================
// IndexedDB helpers
// =============================================================================

/** Opens (or creates) the IndexedDB database. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Runs a single IndexedDB transaction on the audio-blobs store. */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => {
      resolve(request.result);
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Composite key: `{libraryId}/{trackId}`.
 * Scoped per library so clearing one library doesn't affect others.
 */
function makeKey(libraryId: string, trackId: string): string {
  return `${libraryId}/${trackId}`;
}

/**
 * Store an audio blob in IndexedDB.
 *
 * @param libraryId - Library this track belongs to
 * @param trackId   - Unique track identifier
 * @param blob      - Raw audio blob (MP3/WAV/etc.)
 */
export async function storeBlob(
  libraryId: string,
  trackId: string,
  blob: Blob,
): Promise<void> {
  const key = makeKey(libraryId, trackId);
  await withStore('readwrite', store => store.put(blob, key));
}

/**
 * Retrieve an audio blob from IndexedDB.
 *
 * @param libraryId - Library this track belongs to
 * @param trackId   - Unique track identifier
 * @returns The stored Blob, or null if not found
 */
export async function getBlob(
  libraryId: string,
  trackId: string,
): Promise<Blob | null> {
  const key = makeKey(libraryId, trackId);
  const result = await withStore<Blob | undefined>('readonly', store => store.get(key));
  return result ?? null;
}

/**
 * Store multiple audio blobs in a single transaction (batch write).
 * More efficient than individual storeBlob calls for ZIP loading.
 *
 * @param libraryId - Library these tracks belong to
 * @param entries   - Array of { trackId, blob } pairs
 */
export async function storeBlobBatch(
  libraryId: string,
  entries: Array<{ trackId: string; blob: Blob }>,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const { trackId, blob } of entries) {
      store.put(blob, makeKey(libraryId, trackId));
    }

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Delete all audio blobs for a given library.
 * Called when the user uploads a new library or clears storage.
 *
 * @param libraryId - Library to purge
 */
export async function clearLibrary(libraryId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    const prefix = `${libraryId}/`;

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
