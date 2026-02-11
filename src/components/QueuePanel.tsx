import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Music, GripVertical, Clock } from 'lucide-react';
import type { Track, QueueItem } from '../types';
import type { HistoryEntry } from '../lib/sessionPersistence';
import { getTrackBpm } from '../lib/tempoGrouping';

/** Animation duration in ms — matches Carbon productive-motion token */
const ANIM_DURATION = 200;

export interface QueuePanelProps {
  /** Currently playing track (shown at top with "Now Playing" label) */
  currentTrack: Track | null;
  /** Track being prepared for transition */
  nextTrack: Track | null;
  /** Remaining queue items after next */
  queue: QueueItem[];
  /** Callback when user taps a queue item to remove it */
  onRemoveFromQueue: (itemId: string) => void;
  /** Callback when user drags a queue item to reorder */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Play history entries (most recent last) */
  playHistory?: HistoryEntry[];
}

/**
 * Vertical queue panel displayed on the right edge of the screen.
 * Shows Now Playing at top, then Next, then remaining queued tracks.
 * Queued items are draggable to reorder and tappable to remove.
 *
 * Animations:
 *   - Enter: slide-in from right (200ms, Carbon productive-motion easing)
 *   - Exit:  fade-out + height collapse (200ms) on manual remove
 *   - Respects prefers-reduced-motion (WCAG AAA)
 */
export function QueuePanel({
  currentTrack,
  nextTrack,
  queue,
  onRemoveFromQueue,
  onReorder,
  playHistory = [],
}: QueuePanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const hasContent = currentTrack || nextTrack || queue.length > 0;

  // --- Drag-and-drop state ---
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // --- Exit animation state ---
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const exitTimers = useRef<Map<string, number>>(new Map());

  // --- Track previous queue IDs for detecting auto-removed items ---
  const prevQueueIds = useRef<Set<string>>(new Set());

  // Detect items that disappeared from the queue (auto-removed by engine, e.g. track completed)
  useEffect(() => {
    const currentIds = new Set(queue.map(q => q.id));
    // Items that were in the previous queue but not in current (and not already exiting)
    prevQueueIds.current.forEach(id => {
      if (!currentIds.has(id) && !exitingIds.has(id)) {
        // Item was auto-removed — nothing to animate since it's already gone from the array
        // The visual shift is handled by CSS transition on remaining items
      }
    });
    prevQueueIds.current = currentIds;
  }, [queue, exitingIds]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      exitTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  /**
   * Animated remove: adds item to exiting set, waits for animation,
   * then calls the actual remove callback.
   */
  const handleAnimatedRemove = useCallback((itemId: string) => {
    // Skip if already exiting
    if (exitingIds.has(itemId)) return;

    setExitingIds(prev => new Set(prev).add(itemId));

    const timer = window.setTimeout(() => {
      setExitingIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      exitTimers.current.delete(itemId);
      onRemoveFromQueue(itemId);
    }, ANIM_DURATION);

    exitTimers.current.set(itemId, timer);
  }, [exitingIds, onRemoveFromQueue]);

  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  }, []);

  const handleDrop = useCallback((targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndex = dragIndex ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      onReorder(sourceIndex, targetIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  return (
    <aside
      className="flex flex-col h-full bg-cap-800/95 border-l border-cap-700 w-[200px] min-w-[200px]"
      role="complementary"
      aria-label="Playback queue"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-cap-700">
        <h2 className="text-xs font-semibold text-cap-sand uppercase tracking-wider select-none">
          Queue
        </h2>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto" role="list" aria-label="Queued tracks">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center h-full text-cap-sand text-xs px-4 text-center">
            <Music size={24} className="mb-2 opacity-50" />
            <span>No tracks queued</span>
            <span className="mt-1 text-[10px]">Click a track to queue it</span>
          </div>
        )}

        {/* Now Playing */}
        {currentTrack && (
          <QueueEntry
            label="NOW"
            track={currentTrack}
            variant="playing"
          />
        )}

        {/* Next track (being prepared) */}
        {nextTrack && (
          <QueueEntry
            label="NEXT"
            track={nextTrack}
            variant="next"
          />
        )}

        {/* Remaining queue — draggable to reorder, animated enter/exit */}
        {queue.map((item, index) => (
          <QueueEntry
            key={item.id}
            label={`${index + 1}`}
            track={item.track}
            variant="queued"
            onRemove={() => handleAnimatedRemove(item.id)}
            draggable
            isDragging={dragIndex === index}
            isDropTarget={dropIndex === index && dragIndex !== index}
            isExiting={exitingIds.has(item.id)}
            onDragStart={(e) => handleDragStart(index, e)}
            onDragOver={(e) => handleDragOver(index, e)}
            onDrop={(e) => handleDrop(index, e)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Play History (collapsible) */}
      {playHistory.length > 0 && (
        <div className="border-t border-cap-700">
          <button
            onClick={() => setShowHistory(prev => !prev)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-cap-sand uppercase tracking-wider hover:text-cap-cotton transition-colors select-none"
            aria-expanded={showHistory}
            aria-controls="play-history-list"
          >
            <Clock size={12} />
            History ({playHistory.length})
            <span className={`ml-auto transition-transform duration-150 ${showHistory ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showHistory && (
            <div
              id="play-history-list"
              className="max-h-40 overflow-y-auto"
              role="list"
              aria-label="Play history"
            >
              {[...playHistory].reverse().map((entry, i) => (
                <div
                  key={`${entry.trackId}-${entry.playedAt}`}
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-cap-800/50 text-[10px]"
                  role="listitem"
                >
                  <span className="text-cap-sand tabular-nums w-4 flex-shrink-0">{playHistory.length - i}</span>
                  <span className="text-cap-cotton truncate flex-1">{entry.trackName}</span>
                  <span className="text-cap-sand tabular-nums flex-shrink-0">
                    {new Date(entry.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

/** Variant styling for different queue positions */
type EntryVariant = 'playing' | 'next' | 'queued';

interface QueueEntryProps {
  label: string;
  track: Track;
  variant: EntryVariant;
  onRemove?: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  /** True while exit animation is playing (fade-out + collapse) */
  isExiting?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

const variantStyles: Record<EntryVariant, { bg: string; border: string; labelColor: string }> = {
  playing: {
    bg: 'bg-cap-green-deep/20',
    border: 'border-l-cap-green',
    labelColor: 'text-cap-green',
  },
  next: {
    bg: 'bg-cap-gold/15',
    border: 'border-l-cap-yellow',
    labelColor: 'text-cap-yellow',
  },
  queued: {
    bg: 'bg-cap-900/40',
    border: 'border-l-cap-wood',
    labelColor: 'text-cap-sand',
  },
};

function QueueEntry({
  label, track, variant, onRemove,
  draggable: isDraggable, isDragging, isDropTarget, isExiting,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: QueueEntryProps) {
  const style = variantStyles[variant];
  const bpm = Math.round(getTrackBpm(track));

  // Determine animation class:
  //   - Exiting items get the collapse/fade-out animation
  //   - Newly rendered queued items get the slide-in enter animation
  //   - motion-reduce: no animations (WCAG AAA)
  const animClass = isExiting
    ? 'animate-queue-exit motion-reduce:animate-none pointer-events-none'
    : variant === 'queued'
      ? 'animate-queue-enter motion-reduce:animate-none'
      : '';

  return (
    <div
      draggable={isDraggable && !isExiting}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`
        flex items-center gap-1 px-2 py-2
        border-l-4 ${style.border} ${style.bg}
        border-b border-cap-800
        overflow-hidden
        group
        ${isDragging ? 'opacity-40' : ''}
        ${isDropTarget ? 'ring-1 ring-cap-yellow ring-inset' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
        ${animClass}
        transition-all duration-150 motion-reduce:transition-none
      `}
      role="listitem"
      aria-label={`${label}: ${track.name}, ${bpm} BPM`}
      aria-grabbed={isDragging}
    >
      {/* Drag handle (only for draggable items) */}
      {isDraggable && (
        <span className="flex-shrink-0 text-cap-600 group-hover:text-cap-sand transition-colors" aria-hidden="true">
          <GripVertical size={12} />
        </span>
      )}

      {/* Position label */}
      <span className={`text-[10px] font-bold uppercase w-6 flex-shrink-0 ${style.labelColor}`} aria-hidden="true">
        {label}
      </span>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-cap-white truncate leading-tight">
          {track.name}
        </p>
        <p className="text-[10px] font-mono tabular-nums text-cap-cotton">
          {bpm} BPM
        </p>
      </div>

      {/* Remove button (only for queued items, hidden during exit) */}
      {onRemove && !isExiting && (
        <button
          onClick={onRemove}
          className="
            flex-shrink-0 p-1 rounded
            text-cap-500 hover:text-cap-red hover:bg-cap-burgundy/30
            opacity-0 group-hover:opacity-100 focus-visible:opacity-100
            transition-opacity duration-100
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-white
          "
          aria-label={`Remove ${track.name} from queue`}
          title="Remove from queue"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
