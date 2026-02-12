import type { Track, TrackState } from '../types';
import { useMultiClick } from '../hooks/useMultiClick';
import { getTrackBpm } from '../lib/tempoGrouping';

interface TrackButtonProps {
  track: Track;
  state: TrackState;
  height?: number;
  onSingleClick: () => void;
  onDoubleClick: () => void;
  onTripleClick: () => void;
}

/**
 * WCAG AAA contrast ratios (7:1 text, 3:1 non-text).
 * Colours chosen from IBM Carbon palette for high-contrast dark theme.
 */
const stateStyles: Record<TrackState, string> = {
  idle:        'bg-cap-btn hover:bg-cap-btn-hover border-cap-border text-cap-text shadow-sm',
  queued:      'bg-cap-gold-vivid hover:bg-cap-gold-vivid/80 border-cap-yellow text-cap-ink animate-pulse',
  playing:     'bg-cap-green-deep-vivid hover:bg-cap-green-vivid border-cap-green text-cap-paper',
  'mixing-out':'bg-cap-green-deep-vivid/60 border-cap-green/60 text-cap-paper/80',
  'mixing-in': 'bg-cap-green-vivid border-cap-green text-cap-paper animate-pulse',
  disabled:    'bg-cap-surface border-cap-border text-cap-disabled cursor-not-allowed',
};

const stateAriaLabels: Record<TrackState, string> = {
  idle:        '',
  queued:      '(queued)',
  playing:     '(now playing)',
  'mixing-out':'(mixing out)',
  'mixing-in': '(mixing in)',
  disabled:    '(unavailable)',
};

export function TrackButton({ track, state, height, onSingleClick, onDoubleClick, onTripleClick }: TrackButtonProps) {
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
      style={height ? { height: `${height}px` } : undefined}
      className={`
        w-[140px] ${height ? '' : 'h-[72px]'}
        flex flex-col items-center justify-center gap-0.5
        text-center text-sm font-medium
        rounded-lg border-2
        transition-all duration-150
        active:scale-95
        select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text focus-visible:ring-offset-2 focus-visible:ring-offset-cap-bg
        ${stateStyles[state]}
      `}
    >
      <span className="px-1 break-words leading-tight line-clamp-2">
        {track.name}
      </span>
      <span className="text-xs text-cap-text-sec font-mono tabular-nums">
        {bpm} BPM
      </span>
    </button>
  );
}
