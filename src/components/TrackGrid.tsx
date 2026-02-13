import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { TrackButton } from './TrackButton';
import { groupTracksByTempo } from '../lib/tempoGrouping';
import type { Track, TrackState } from '../types';

// =============================================================================
// Layout constants (match Tailwind classes used in JSX)
// =============================================================================

/** Vertical padding inside grid container (p-3 = 12px each side) */
const GRID_PADDING = 12;
/** Gap between tempo rows (gap-2 = 8px) */
const ROW_GAP = 8;
/** Height consumed by each row's BPM label + margin */
const ROW_HEADER_HEIGHT = 20;
/** Minimum readable button height (px) */
const MIN_BUTTON_HEIGHT = 48;
/** Maximum button height to prevent oversized buttons on large screens */
const MAX_BUTTON_HEIGHT = 100;
/** Minimum tempo rows to display */
const MIN_ROWS = 2;
/** Maximum tempo rows to display */
const MAX_ROWS = 10;
/** Debounce interval (ms) for ResizeObserver to avoid excessive layout recalcs */
const RESIZE_DEBOUNCE_MS = 100;

// =============================================================================
// Pure layout calculation (testable, no React deps)
// =============================================================================

interface GridLayout {
  /** Number of tempo rows that fit in the available height */
  rowCount: number;
  /** Computed button height (px) to fill available space evenly */
  buttonHeight: number;
}

/**
 * Calculate the optimal number of tempo rows and button height for a given
 * container height. Rows are fitted top-down at minimum button height, then
 * the remaining space is distributed evenly across all buttons.
 *
 * Formula:
 *   available = containerHeight - 2 × GRID_PADDING
 *   Each row consumes: ROW_HEADER_HEIGHT + buttonHeight
 *   Between rows: ROW_GAP × (rows - 1)
 *   Solve for max rows at MIN_BUTTON_HEIGHT, then re-derive actual height.
 *
 * @param containerHeight - Measured height of the grid container (px)
 * @returns GridLayout with rowCount and buttonHeight
 */
export function calculateGridLayout(containerHeight: number): GridLayout {
  const available = containerHeight - GRID_PADDING * 2;

  // How many rows fit at the minimum button height?
  const rowWithMinBtn = ROW_HEADER_HEIGHT + MIN_BUTTON_HEIGHT;
  const maxFit = Math.floor((available + ROW_GAP) / (rowWithMinBtn + ROW_GAP));
  const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, maxFit));

  // Distribute remaining vertical space evenly across button heights
  const spaceForButtons = available - rows * ROW_HEADER_HEIGHT - (rows - 1) * ROW_GAP;
  const buttonHeight = Math.max(
    MIN_BUTTON_HEIGHT,
    Math.min(MAX_BUTTON_HEIGHT, Math.floor(spaceForButtons / rows)),
  );

  return { rowCount: rows, buttonHeight };
}

// =============================================================================
// Component
// =============================================================================

export interface TrackGridProps {
  tracks: Track[];
  currentTrackId: string | null;
  queuedTrackId: string | null;
  queuedTrackIds: string[];
  mixProgress: number;
  onSingleClick: (track: Track) => void;
  onDoubleClick: (track: Track) => void;
  onTripleClick: (track: Track) => void;
}

/**
 * Liquid grid of track buttons grouped into tempo rows.
 *
 * The number of rows and button height adapt dynamically to the container's
 * available height (via ResizeObserver) so that the grid fills the viewport
 * with no vertical scrolling. Rows scroll horizontally if they overflow.
 */
export function TrackGrid({ 
  tracks, 
  currentTrackId, 
  queuedTrackId,
  queuedTrackIds,
  mixProgress,
  onSingleClick,
  onDoubleClick,
  onTripleClick,
}: TrackGridProps) {
  // Stable callback refs — prevents new function identity per render,
  // so React.memo on TrackButton can skip re-renders.
  const singleClickRef = useRef(onSingleClick);
  singleClickRef.current = onSingleClick;
  const doubleClickRef = useRef(onDoubleClick);
  doubleClickRef.current = onDoubleClick;
  const tripleClickRef = useRef(onTripleClick);
  tripleClickRef.current = onTripleClick;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Debounced ResizeObserver — avoids excessive layout recalculations
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver((entries) => {
      // Cancel any pending update
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);

      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(() => {
          for (const entry of entries) {
            setContainerHeight(entry.contentRect.height);
          }
        });
      }, RESIZE_DEBOUNCE_MS);
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Pure layout calculation (memoised on container height)
  const { rowCount, buttonHeight } = useMemo(
    () => calculateGridLayout(containerHeight),
    [containerHeight],
  );

  // Group tracks into the calculated number of tempo rows
  const tempoRows = useMemo(
    () => groupTracksByTempo(tracks, rowCount),
    [tracks, rowCount],
  );

  // O(1) lookup set for queued track IDs (avoids O(n) .includes() per button)
  const queuedIdSet = useMemo(() => new Set(queuedTrackIds), [queuedTrackIds]);

  /** Derive visual state for a single track button */
  const getTrackState = useCallback((track: Track): TrackState => {
    if (track.id === currentTrackId && mixProgress > 0) return 'mixing-out';
    if (track.id === currentTrackId) return 'playing';
    if (track.id === queuedTrackId && mixProgress > 0) return 'mixing-in';
    if (track.id === queuedTrackId) return 'queued';
    if (queuedIdSet.has(track.id)) return 'queued';
    if (!track.beatMap) return 'disabled';
    return 'idle';
  }, [currentTrackId, queuedTrackId, queuedIdSet, mixProgress]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-2 p-3 bg-cap-bg h-full"
      role="region"
      aria-label="Track library"
    >
      {tempoRows.map((row) => (
        <section
          key={row.label}
          aria-label={`Tempo group: ${row.label}`}
          className="flex flex-col min-h-0"
        >
          {/* Row header with BPM range label */}
          <h2 className="text-xs font-semibold text-cap-muted uppercase tracking-wider px-1 mb-0.5 select-none flex-shrink-0">
            {row.label}
          </h2>
          {/* Horizontally scrollable row of track buttons */}
          <div
            className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin flex-1 items-stretch"
            role="list"
            aria-label={row.label}
          >
            {row.tracks.map(track => (
              <div key={track.id} role="listitem" className="flex-shrink-0">
                <TrackButton
                  track={track}
                  state={getTrackState(track)}
                  height={buttonHeight}
                  onSingleClick={() => singleClickRef.current(track)}
                  onDoubleClick={() => doubleClickRef.current(track)}
                  onTripleClick={() => tripleClickRef.current(track)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
