/**
 * sessionPersistence.ts — Lightweight session state persistence.
 *
 * Saves the playback queue and play history to localStorage so they
 * survive page reloads. Only track IDs and settings are stored (no
 * binary audio data); tracks are rehydrated from IndexedDB on restore.
 *
 * Storage key: `mm-session-{libraryId}`
 *
 * @module sessionPersistence
 */

import type { Track, QueueItem, QueueItemSettings } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A serialisable reference to a queued track (no Blob data) */
interface PersistedQueueItem {
  trackId: string;
  settings: QueueItemSettings;
}

/** A single play-history entry */
export interface HistoryEntry {
  trackId: string;
  trackName: string;
  playedAt: number;
}

/** Shape of the persisted session blob */
interface SessionBlob {
  /** Track IDs in queue order */
  queue: PersistedQueueItem[];
  /** ID of the track that was playing when session was saved */
  currentTrackId: string | null;
  /** Chronological play history (oldest first) */
  history: HistoryEntry[];
  /** Timestamp of last save */
  savedAt: number;
}

// ---------------------------------------------------------------------------
// Storage key helpers
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'mm-session-';

function storageKey(libraryId: string): string {
  return `${STORAGE_PREFIX}${libraryId}`;
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Persist the current queue and history to localStorage.
 *
 * @param libraryId      - Active library ID (scopes the save)
 * @param queue          - Current queue items
 * @param currentTrackId - ID of the currently-playing track (or null)
 * @param history        - Play history entries
 */
export function saveSession(
  libraryId: string,
  queue: QueueItem[],
  currentTrackId: string | null,
  history: HistoryEntry[],
): void {
  const blob: SessionBlob = {
    queue: queue.map(item => ({
      trackId: item.track.id,
      settings: item.settings,
    })),
    currentTrackId,
    history,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(storageKey(libraryId), JSON.stringify(blob));
  } catch (err) {
    // localStorage full or disabled — fail silently
    console.warn('[Session] Failed to save session:', err);
  }
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/** Restored session data with full Track references */
export interface RestoredSession {
  queue: Array<{ track: Track; settings: QueueItemSettings }>;
  currentTrackId: string | null;
  history: HistoryEntry[];
}

/**
 * Restore a previously-saved session for the given library.
 *
 * @param libraryId - Library ID to look up
 * @param tracks    - All tracks in the library (used to rehydrate IDs → Track objects)
 * @returns Restored session or null if nothing saved / tracks missing
 */
export function restoreSession(
  libraryId: string,
  tracks: Track[],
): RestoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey(libraryId));
    if (!raw) return null;

    const blob: SessionBlob = JSON.parse(raw);

    // Build a lookup map: trackId → Track
    const trackMap = new Map(tracks.map(t => [t.id, t]));

    // Rehydrate queue — skip items whose track no longer exists
    const queue = blob.queue
      .map(item => {
        const track = trackMap.get(item.trackId);
        if (!track) return null;
        return { track, settings: item.settings };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      queue,
      currentTrackId: blob.currentTrackId,
      history: blob.history ?? [],
    };
  } catch (err) {
    console.warn('[Session] Failed to restore session:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

/** Maximum history entries to keep (prevent unbounded growth) */
const MAX_HISTORY = 200;

/**
 * Append a track to the play history.
 * Returns a new array (immutable update for React state).
 */
export function appendHistory(
  history: HistoryEntry[],
  track: Track,
): HistoryEntry[] {
  const entry: HistoryEntry = {
    trackId: track.id,
    trackName: track.name,
    playedAt: Date.now(),
  };
  const updated = [...history, entry];
  // Trim to max size
  if (updated.length > MAX_HISTORY) {
    return updated.slice(updated.length - MAX_HISTORY);
  }
  return updated;
}

/**
 * Clear saved session for a library.
 */
export function clearSession(libraryId: string): void {
  try {
    localStorage.removeItem(storageKey(libraryId));
  } catch {
    // Ignore
  }
}
