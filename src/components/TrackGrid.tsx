import { useMemo } from 'react';
import { TrackButton } from './TrackButton';
import { groupTracksByTempo } from '../lib/tempoGrouping';
import type { Track, TrackState } from '../types';

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
  // Group tracks into tempo-based rows (quintiles, slowest → fastest)
  const tempoRows = useMemo(() => groupTracksByTempo(tracks), [tracks]);

  const getTrackState = (track: Track): TrackState => {
    if (track.id === currentTrackId && mixProgress > 0) return 'mixing-out';
    if (track.id === currentTrackId) return 'playing';
    if (track.id === queuedTrackId && mixProgress > 0) return 'mixing-in';
    if (track.id === queuedTrackId) return 'queued';
    if (queuedTrackIds.includes(track.id)) return 'queued';
    if (!track.beatMap) return 'disabled';
    return 'idle';
  };

  return (
    <div className="flex flex-col gap-2 p-3" role="region" aria-label="Track library">
      {tempoRows.map((row) => (
        <section
          key={row.label}
          aria-label={`Tempo group: ${row.label}`}
        >
          {/* Row header with BPM range label */}
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1 select-none">
            {row.label}
          </h2>
          {/* Horizontally scrollable row of track buttons */}
          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
            role="list"
            aria-label={row.label}
          >
            {row.tracks.map(track => (
              <div key={track.id} role="listitem" className="flex-shrink-0">
                <TrackButton
                  track={track}
                  state={getTrackState(track)}
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
