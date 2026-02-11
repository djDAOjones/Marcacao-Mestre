/**
 * QueueManager — Pure data manager for the playback queue.
 *
 * Handles all queue CRUD operations (add, remove, reorder, shift) without
 * any audio or deck dependencies. This separation allows queue logic to be
 * tested independently and prepares for Phase 5 persistence features.
 *
 * The DualDeckEngine owns the QueueManager instance and delegates all
 * queue data operations to it, while retaining control over audio/deck
 * orchestration (loading tracks, triggering mixes, etc.).
 */

import type { Track, QueueItem, TransitionMode } from '../types';

/** Settings snapshot used when creating a new queue item */
export interface QueueItemConfig {
  transitionMode: TransitionMode;
  targetBpm: number;
}

export class QueueManager {
  /** Ordered list of upcoming tracks */
  private queue: QueueItem[] = [];

  /** The item currently being prepared or playing as the "next" transition */
  private activeItem: QueueItem | null = null;

  /** Auto-incrementing counter for unique queue item IDs */
  private idCounter: number = 0;

  // ---------------------------------------------------------------------------
  // Item creation
  // ---------------------------------------------------------------------------

  /**
   * Create a QueueItem without adding it to the queue.
   * Used for bypass flows (triple-click, queueTrack) where the item goes
   * directly to prepareQueueItem instead of through the normal queue.
   */
  createItem(track: Track, config: QueueItemConfig): QueueItem {
    return {
      id: `q-${++this.idCounter}`,
      track,
      settings: {
        transitionMode: config.transitionMode,
        targetBpm: config.targetBpm,
      },
      queuedAt: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Queue CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create a QueueItem from a track and current config, then insert it
   * at the specified position.
   *
   * @param track    - The track to queue
   * @param position - 'end' appends; 'next' inserts at front
   * @param config   - Snapshot of current transition settings
   * @returns The created QueueItem
   */
  add(track: Track, position: 'end' | 'next', config: QueueItemConfig): QueueItem {
    const item: QueueItem = {
      id: `q-${++this.idCounter}`,
      track,
      settings: {
        transitionMode: config.transitionMode,
        targetBpm: config.targetBpm,
      },
      queuedAt: Date.now(),
    };

    if (position === 'next') {
      this.queue.unshift(item);
    } else {
      this.queue.push(item);
    }

    return item;
  }

  /**
   * Remove an item from the queue by its unique ID.
   * Does not affect the activeItem — only the pending queue.
   *
   * @returns The removed item, or null if not found
   */
  remove(itemId: string): QueueItem | null {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index === -1) return null;
    return this.queue.splice(index, 1)[0];
  }

  /**
   * Move a queue item from one index to another (drag-and-drop reorder).
   * No-op if indices are out of bounds or equal.
   */
  reorder(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.queue.length) return;
    if (toIndex < 0 || toIndex >= this.queue.length) return;
    if (fromIndex === toIndex) return;

    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);
  }

  /**
   * Shift the first item off the queue (FIFO).
   * Used by advanceQueue to move the next track into preparation.
   *
   * @returns The shifted item, or null if queue is empty
   */
  shift(): QueueItem | null {
    return this.queue.shift() ?? null;
  }

  /**
   * Push an item to the front of the queue (un-shift).
   * Used to preserve the activeItem when a triple-click interrupts it.
   */
  unshiftItem(item: QueueItem): void {
    this.queue.unshift(item);
  }

  // ---------------------------------------------------------------------------
  // Active item (the "next up" track being prepared / loaded into inactive deck)
  // ---------------------------------------------------------------------------

  /** Get the currently active (preparing/prepared) queue item */
  getActiveItem(): QueueItem | null {
    return this.activeItem;
  }

  /** Set the active item (called after track is loaded into inactive deck) */
  setActiveItem(item: QueueItem | null): void {
    this.activeItem = item;
  }

  /** Clear the active item (called after a mix completes or is cancelled) */
  clearActiveItem(): void {
    this.activeItem = null;
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /** Get a shallow copy of the queue (safe for React state) */
  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  /** Number of items in the queue (excluding activeItem) */
  get length(): number {
    return this.queue.length;
  }

  /** True if both the queue and activeItem are empty */
  get isEmpty(): boolean {
    return this.queue.length === 0 && this.activeItem === null;
  }

  /**
   * Get the "next track" for display: activeItem takes priority,
   * then the first item in the queue.
   */
  getNextTrack(): Track | null {
    return this.activeItem?.track ?? this.queue[0]?.track ?? null;
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  /** Clear everything — queue and active item */
  clear(): void {
    this.queue = [];
    this.activeItem = null;
  }
}
