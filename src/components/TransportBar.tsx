/**
 * TransportBar — Thin progress/scrub bar anchored to the bottom of the viewport.
 *
 * Shows: [Track Name] [progress bar with scrub] [current / total time]
 *
 * Design rationale:
 *   - Nielsen #1 (Visibility of system status): always-visible playback position
 *   - Nielsen #3 (User control & freedom): drag to reposition playhead
 *   - IBM Carbon: 48px min touch target for the scrub region
 *   - WCAG AAA: role="slider", keyboard arrows, high-contrast fill
 *
 * Height: 36px — minimal vertical footprint for 1024×768 fit.
 * Always visible: shows 'No track loaded' placeholder when idle.
 */

import { useRef, useCallback } from 'react';

/** Format seconds as m:ss */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface TransportBarProps {
  trackName: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isMixing: boolean;
  onSeek: (position: number) => void;
}

export function TransportBar({
  trackName,
  currentTime,
  duration,
  isPlaying,
  isMixing,
  onSeek,
}: TransportBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const isIdle = !trackName || duration <= 0;
  const progress = isIdle ? 0 : Math.min(currentTime / duration, 1);

  /** Convert a pointer X position to a seek time */
  const getSeekTime = (clientX: number): number => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isIdle || isMixing) return; // Disable scrub when idle or during crossfade
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSeek(getSeekTime(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    onSeek(getSeekTime(e.clientX));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  /** Keyboard scrub: left/right arrows ±5s, shift ±15s */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isIdle || isMixing) return;
    const step = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowRight') {
      onSeek(Math.min(currentTime + step, duration));
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      onSeek(Math.max(currentTime - step, 0));
      e.preventDefault();
    }
  }, [isIdle, currentTime, duration, isMixing, onSeek]);

  return (
    <div
      className="flex items-center gap-3 px-4 bg-cap-panel border-t border-cap-border h-9 select-none flex-shrink-0"
      role="region"
      aria-label="Transport progress"
    >
      {/* Track name — truncated, or placeholder when idle */}
      <span className={`text-xs font-medium truncate min-w-0 max-w-[180px] ${isIdle ? 'text-cap-disabled italic' : 'text-cap-text-sec'}`}>
        {isIdle ? 'No track loaded' : trackName}
      </span>

      {/* Progress bar / scrub region */}
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        className={`
          flex-1 h-6 flex items-center cursor-pointer rounded
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
          ${isIdle || isMixing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {/* Track (background) */}
        <div className="w-full h-1.5 bg-cap-border/40 rounded-full relative">
          {/* Fill */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-100
              ${isPlaying ? 'bg-cap-green' : 'bg-cap-muted'}`}
            style={{ width: `${progress * 100}%` }}
          />
          {/* Scrub handle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2
              transition-[left] duration-100 shadow-sm
              ${isPlaying ? 'bg-cap-green border-cap-green-deep' : 'bg-cap-muted border-cap-border'}
              ${isIdle || isMixing ? 'hidden' : ''}`}
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>
      </div>

      {/* Time display */}
      <span className="text-xs font-mono text-cap-muted whitespace-nowrap tabular-nums">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
