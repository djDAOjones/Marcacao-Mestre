import type { Track, TrackState } from '../types';
import { useMultiClick } from '../hooks/useMultiClick';
import { getTrackBpm } from '../lib/tempoGrouping';

interface TrackButtonProps {
  track: Track;
  state: TrackState;
  onSingleClick: () => void;
  onDoubleClick: () => void;
  onTripleClick: () => void;
}

/**
 * WCAG AAA contrast ratios (7:1 text, 3:1 non-text).
 * Colours chosen from IBM Carbon palette for high-contrast dark theme.
 */
const stateStyles: Record<TrackState, string> = {
  idle:        'bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-50',
  queued:      'bg-amber-700 hover:bg-amber-600 border-amber-400 text-white animate-pulse',
  playing:     'bg-green-700 hover:bg-green-600 border-green-400 text-white',
  'mixing-out':'bg-green-700/60 border-green-400/60 text-white/80',
  'mixing-in': 'bg-green-600 border-green-300 text-white animate-pulse',
  disabled:    'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed',
};

const stateAriaLabels: Record<TrackState, string> = {
  idle:        '',
  queued:      '(queued)',
  playing:     '(now playing)',
  'mixing-out':'(mixing out)',
  'mixing-in': '(mixing in)',
  disabled:    '(unavailable)',
};

export function TrackButton({ track, state, onSingleClick, onDoubleClick, onTripleClick }: TrackButtonProps) {
  const handleClick = useMultiClick({
    delay: 300,
    onSingleClick,
    onDoubleClick,
    onTripleClick,
  });

  const bpm = Math.round(getTrackBpm(track));
  const ariaLabel = `${track.name}, ${bpm} BPM ${stateAriaLabels[state]}`.trim();

  return (
    <button
      onClick={handleClick}
      disabled={state === 'disabled'}
      aria-label={ariaLabel}
      aria-pressed={state === 'playing' || state === 'queued'}
      className={`
        w-[120px] h-[64px]
        flex flex-col items-center justify-center gap-0.5
        text-center text-xs font-medium
        rounded-lg border-2
        transition-all duration-150
        active:scale-95
        select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
        ${stateStyles[state]}
      `}
    >
      <span className="px-1 break-words leading-tight line-clamp-2">
        {track.name}
      </span>
      <span className="text-[10px] opacity-70 font-mono tabular-nums">
        {bpm} BPM
      </span>
    </button>
  );
}
