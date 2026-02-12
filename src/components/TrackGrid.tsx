import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { TrackButton } from './TrackButton';
import { groupTracksByTempo } from '../lib/tempoGrouping';
import type { Track, TrackState } from '../types';

/** Layout constants */
const GRID_PADDING = 12;       // p-3 = 12px top + 12px bottom
const ROW_GAP = 8;             // gap-2 = 8px between rows
const ROW_HEADER_HEIGHT = 24;  // text-sm header + mb-1
const MIN_BUTTON_HEIGHT = 48;  // minimum readable button height
const MAX_BUTTON_HEIGHT = 100; // don't let buttons get absurdly tall
const MIN_ROWS = 2;
const MAX_ROWS = 10;

export interface TrackGridProps {
  tracks: Track[];
  columns: number;
  currentTrackId: string | null;
  queuedTrackId: string | null;
  queuedTrackIds: string[];
  mixProgress: number;
  onSingleClick: (track: Track) => void;
  onDoubleClick: (track: Track) => void;
  onTripleClick: (track: Track) => void;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Measure available height via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Calculate how many rows fit and the button height
  const { rowCount, buttonHeight } = useMemo(() => {
    const available = containerHeight - GRID_PADDING * 2;

    // Calculate how many rows fit with minimum button height
    // Each row = ROW_HEADER_HEIGHT + buttonHeight + ROW_GAP (except last row, no trailing gap)
    // N rows: N * (ROW_HEADER_HEIGHT + buttonHeight) + (N-1) * ROW_GAP = available
    // Solve for N with buttonHeight = MIN_BUTTON_HEIGHT:
    const rowWithMinBtn = ROW_HEADER_HEIGHT + MIN_BUTTON_HEIGHT;
    const maxFit = Math.floor((available + ROW_GAP) / (rowWithMinBtn + ROW_GAP));
    const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, maxFit));

    // Now calculate actual button height to fill available space
    const spaceForButtons = available - rows * ROW_HEADER_HEIGHT - (rows - 1) * ROW_GAP;
    const btnH = Math.max(MIN_BUTTON_HEIGHT, Math.min(MAX_BUTTON_HEIGHT, Math.floor(spaceForButtons / rows)));

    return { rowCount: rows, buttonHeight: btnH };
  }, [containerHeight]);

  // Group tracks into the calculated number of rows
  const tempoRows = useMemo(() => groupTracksByTempo(tracks, rowCount), [tracks, rowCount]);

  const getTrackState = useCallback((track: Track): TrackState => {
    if (track.id === currentTrackId && mixProgress > 0) return 'mixing-out';
    if (track.id === currentTrackId) return 'playing';
    if (track.id === queuedTrackId && mixProgress > 0) return 'mixing-in';
    if (track.id === queuedTrackId) return 'queued';
    if (queuedTrackIds.includes(track.id)) return 'queued';
    if (!track.beatMap) return 'disabled';
    return 'idle';
  }, [currentTrackId, queuedTrackId, queuedTrackIds, mixProgress]);

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
                  onSingleClick={() => onSingleClick(track)}
                  onDoubleClick={() => onDoubleClick(track)}
                  onTripleClick={() => onTripleClick(track)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
