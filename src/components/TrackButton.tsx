import type { Track, TrackState } from '../types';

interface TrackButtonProps {
  track: Track;
  state: TrackState;
  onClick: () => void;
}

export function TrackButton({ track, state, onClick }: TrackButtonProps) {
  const stateStyles: Record<TrackState, string> = {
    idle: 'bg-gray-700 hover:bg-gray-600 border-gray-600',
    queued: 'bg-amber-600 hover:bg-amber-500 border-amber-400 animate-pulse',
    playing: 'bg-green-600 hover:bg-green-500 border-green-400',
    'mixing-out': 'bg-green-600/50 border-green-400/50',
    'mixing-in': 'bg-green-500 border-green-300 animate-pulse',
    disabled: 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed',
  };

  return (
    <button
      onClick={onClick}
      disabled={state === 'disabled'}
      className={`
        w-full aspect-square min-h-[100px]
        flex items-center justify-center
        text-center text-lg font-semibold
        rounded-xl border-2
        transition-all duration-150
        active:scale-95
        select-none
        ${stateStyles[state]}
      `}
    >
      <span className="px-2 break-words leading-tight">
        {track.name}
      </span>
    </button>
  );
}
