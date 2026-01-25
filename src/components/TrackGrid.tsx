import { TrackButton } from './TrackButton';
import type { Track, TrackState } from '../types';

export interface TrackGridProps {
  tracks: Track[];
  columns: number;
  currentTrackId: string | null;
  queuedTrackId: string | null;
  mixProgress: number;
  onSingleClick: (track: Track) => void;
  onDoubleClick: (track: Track) => void;
  onTripleClick: (track: Track) => void;
}

export function TrackGrid({ 
  tracks, 
  columns, 
  currentTrackId, 
  queuedTrackId,
  mixProgress,
  onSingleClick,
  onDoubleClick,
  onTripleClick,
}: TrackGridProps) {
  const getTrackState = (track: Track): TrackState => {
    if (track.id === currentTrackId && mixProgress > 0) return 'mixing-out';
    if (track.id === currentTrackId) return 'playing';
    if (track.id === queuedTrackId && mixProgress > 0) return 'mixing-in';
    if (track.id === queuedTrackId) return 'queued';
    if (!track.beatMap) return 'disabled';
    return 'idle';
  };

  return (
    <div 
      className="grid gap-3 p-4"
      style={{ 
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` 
      }}
    >
      {tracks.map(track => (
        <TrackButton
          key={track.id}
          track={track}
          state={getTrackState(track)}
          onSingleClick={() => onSingleClick(track)}
          onDoubleClick={() => onDoubleClick(track)}
          onTripleClick={() => onTripleClick(track)}
        />
      ))}
    </div>
  );
}
