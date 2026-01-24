import { TrackButton } from './TrackButton';
import type { Track, TrackState } from '../types';

interface TrackGridProps {
  tracks: Track[];
  columns: number;
  currentTrackId: string | null;
  onTrackSelect: (track: Track) => void;
}

export function TrackGrid({ tracks, columns, currentTrackId, onTrackSelect }: TrackGridProps) {
  const getTrackState = (track: Track): TrackState => {
    if (track.id === currentTrackId) return 'playing';
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
          onClick={() => onTrackSelect(track)}
        />
      ))}
    </div>
  );
}
