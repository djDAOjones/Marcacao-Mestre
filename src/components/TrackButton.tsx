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
  idle:        'bg-cap-700 hover:bg-cap-600 border-cap-500 text-cap-white',
  queued:      'bg-cap-gold hover:bg-cap-gold/80 border-cap-yellow text-cap-black animate-pulse',
  playing:     'bg-cap-green-deep hover:bg-cap-green border-cap-green text-cap-white',
  'mixing-out':'bg-cap-green-deep/60 border-cap-green/60 text-cap-white/80',
  'mixing-in': 'bg-cap-green border-cap-green text-cap-white animate-pulse',
  disabled:    'bg-cap-900 border-cap-700 text-cap-500 cursor-not-allowed',
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
      title="Click: queue · Double-click: play next · Triple-click: mix now"
      className={`
        w-[140px] h-[72px]
        flex flex-col items-center justify-center gap-0.5
        text-center text-sm font-medium
        rounded-lg border-2
        transition-all duration-150
        active:scale-95
        select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-white focus-visible:ring-offset-2 focus-visible:ring-offset-cap-black
        ${stateStyles[state]}
      `}
    >
      <span className="px-1 break-words leading-tight line-clamp-2">
        {track.name}
      </span>
      <span className="text-xs text-cap-cotton font-mono tabular-nums">
        {bpm} BPM
      </span>
    </button>
  );
}
