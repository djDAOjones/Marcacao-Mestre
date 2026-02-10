import { X, Music } from 'lucide-react';
import type { Track, QueueItem } from '../types';
import { getTrackBpm } from '../lib/tempoGrouping';

export interface QueuePanelProps {
  /** Currently playing track (shown at top with "Now Playing" label) */
  currentTrack: Track | null;
  /** Track being prepared for transition */
  nextTrack: Track | null;
  /** Remaining queue items after next */
  queue: QueueItem[];
  /** Callback when user taps a queue item to remove it */
  onRemoveFromQueue: (itemId: string) => void;
}

/**
 * Vertical queue panel displayed on the right edge of the screen.
 * Shows Now Playing at top, then Next, then remaining queued tracks.
 * Tap any queued item to remove it. WCAG AAA compliant.
 */
export function QueuePanel({
  currentTrack,
  nextTrack,
  queue,
  onRemoveFromQueue,
}: QueuePanelProps) {
  const hasContent = currentTrack || nextTrack || queue.length > 0;

  return (
    <aside
      className="flex flex-col h-full bg-gray-900/95 border-l border-gray-700 w-[200px] min-w-[200px]"
      role="complementary"
      aria-label="Playback queue"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider select-none">
          Queue
        </h2>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto" role="list" aria-label="Queued tracks">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs px-4 text-center">
            <Music size={24} className="mb-2 opacity-40" />
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

        {/* Remaining queue */}
        {queue.map((item, index) => (
          <QueueEntry
            key={item.id}
            label={`${index + 1}`}
            track={item.track}
            variant="queued"
            onRemove={() => onRemoveFromQueue(item.id)}
          />
        ))}
      </div>
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
}

const variantStyles: Record<EntryVariant, { bg: string; border: string; labelColor: string }> = {
  playing: {
    bg: 'bg-green-900/40',
    border: 'border-l-green-400',
    labelColor: 'text-green-400',
  },
  next: {
    bg: 'bg-amber-900/30',
    border: 'border-l-amber-400',
    labelColor: 'text-amber-400',
  },
  queued: {
    bg: 'bg-gray-800/40',
    border: 'border-l-gray-500',
    labelColor: 'text-gray-400',
  },
};

function QueueEntry({ label, track, variant, onRemove }: QueueEntryProps) {
  const style = variantStyles[variant];
  const bpm = Math.round(getTrackBpm(track));

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2
        border-l-4 ${style.border} ${style.bg}
        border-b border-gray-800
        group
      `}
      role="listitem"
      aria-label={`${label}: ${track.name}, ${bpm} BPM`}
    >
      {/* Position label */}
      <span className={`text-[10px] font-bold uppercase w-8 flex-shrink-0 ${style.labelColor}`}>
        {label}
      </span>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-100 truncate leading-tight">
          {track.name}
        </p>
        <p className="text-[10px] font-mono tabular-nums text-gray-400">
          {bpm} BPM
        </p>
      </div>

      {/* Remove button (only for queued items) */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="
            flex-shrink-0 p-1 rounded
            text-gray-500 hover:text-red-400 hover:bg-red-900/30
            opacity-0 group-hover:opacity-100 focus-visible:opacity-100
            transition-opacity duration-100
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
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
