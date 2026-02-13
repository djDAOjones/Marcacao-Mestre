import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Pause, Play, SkipBack, SkipForward,
  VolumeX, Lock, Unlock,
  Settings, Trash2, Sun, Moon, Mic,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { AppSettings } from '../types';
import type { TransportState } from '../lib/dualDeckEngine';

export interface ControlBarProps {
  transportState: TransportState;
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onTogglePause: () => void;
  onTriggerNext: () => void;
  onRewind: () => void;
  onClearQueue?: () => void;
}

/**
 * ControlBar — Single-row playback control strip.
 *
 * Layout (left → right):
 *   Left:   [Settings ▾] [BPM] [TALK]
 *   Right:  [⏮ BACK] [⏭ NEXT] [⏯ PLAY/PAUSE]
 *
 * Status info (NOW/NEXT/STATUS) removed — redundant with QueuePanel
 * and track grid highlights (Nielsen #8: minimalist design).
 * BPM is interactive: click to type, drag to adjust.
 *
 * Design: IBM Carbon 48px min touch targets, WCAG AAA focus rings,
 *         single row saves ~56px vs two-row layout (fits 1024×768).
 */
export function ControlBar({
  transportState,
  settings,
  onSettingsChange,
  onTogglePause,
  onTriggerNext,
  onRewind,
  onClearQueue,
}: ControlBarProps) {
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [editBpmValue, setEditBpmValue] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartBpm = useRef<number>(120);

  // Close settings dropdown on click outside or Escape
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSettingsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSettingsOpen]);

  const handleBpmClick = useCallback(() => {
    setEditBpmValue(Math.round(transportState.currentBpm).toString());
    setIsEditingBpm(true);
  }, [transportState.currentBpm]);

  const handleBpmSubmit = useCallback(() => {
    const newBpm = parseInt(editBpmValue, 10);
    if (!isNaN(newBpm) && newBpm >= 60 && newBpm <= 200) {
      onSettingsChange({ targetBpm: newBpm, fixTempo: true });
    }
    setIsEditingBpm(false);
  }, [editBpmValue, onSettingsChange]);

  const handleBpmKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBpmSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingBpm(false);
    }
  }, [handleBpmSubmit]);

  const handleBpmDragStart = useCallback((e: React.MouseEvent) => {
    if (isEditingBpm) return;
    dragStartY.current = e.clientY;
    dragStartBpm.current = settings.targetBpm || transportState.currentBpm;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (dragStartY.current === null) return;
      const deltaY = dragStartY.current - moveEvent.clientY;
      const deltaBpm = Math.round(deltaY * 0.5);
      const newBpm = Math.max(60, Math.min(200, dragStartBpm.current + deltaBpm));
      onSettingsChange({ targetBpm: newBpm, fixTempo: true });
    };

    const handleMouseUp = () => {
      dragStartY.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isEditingBpm, settings.targetBpm, transportState.currentBpm, onSettingsChange]);

  const { theme, toggleTheme } = useTheme();
  const hasQueuedTrack = transportState.nextTrack !== null || transportState.phase === 'queued';

  return (
    <nav className="bg-cap-panel border-b border-cap-border" role="toolbar" aria-label="Playback controls">
      {/* Single-row controls — status info removed (redundant with QueuePanel + grid highlights) */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Settings Dropdown — contains MIX/CUT, Tempo Lock, Mix Duration, Clear Queue */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(prev => !prev)}
              aria-expanded={isSettingsOpen}
              aria-haspopup="menu"
              aria-label="Settings menu"
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-lg font-bold transition-colors min-h-[48px]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
                ${isSettingsOpen
                  ? 'bg-cap-btn-hover text-cap-text'
                  : 'bg-cap-btn text-cap-text-sec hover:bg-cap-btn-hover'}
              `}
            >
              <Settings size={24} />
              <span className="hidden sm:inline">SETTINGS</span>
            </button>

            {isSettingsOpen && (
              <div
                className="absolute top-full left-0 mt-2 w-72 bg-cap-surface border border-cap-border rounded-xl shadow-xl z-50 overflow-hidden"
                role="menu"
                aria-label="Settings"
              >
                {/* MIX / CUT Toggle */}
                <div className="px-4 py-2 border-b border-cap-border">
                  <label className="text-sm font-semibold text-cap-muted uppercase tracking-wider mb-1.5 block">
                    Transition Mode
                  </label>
                  <div className="flex items-center bg-cap-bg rounded-lg p-1" role="radiogroup" aria-label="Transition mode">
                    <button
                      onClick={() => onSettingsChange({ transitionMode: 'mix' })}
                      aria-checked={settings.transitionMode === 'mix'}
                      role="radio"
                      className={`
                        flex-1 px-4 py-2 rounded-md text-base font-bold transition-colors min-h-[48px]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
                        ${settings.transitionMode === 'mix' 
                          ? 'bg-cap-blue-vivid text-cap-paper' 
                          : 'text-cap-muted hover:text-cap-text'}
                      `}
                    >
                      MIX
                    </button>
                    <button
                      onClick={() => onSettingsChange({ transitionMode: 'cut' })}
                      aria-checked={settings.transitionMode === 'cut'}
                      role="radio"
                      className={`
                        flex-1 px-4 py-2 rounded-md text-base font-bold transition-colors min-h-[48px]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
                        ${settings.transitionMode === 'cut' 
                          ? 'bg-cap-gourd-vivid text-cap-paper' 
                          : 'text-cap-muted hover:text-cap-text'}
                      `}
                    >
                      CUT
                    </button>
                  </div>
                  <p className="text-xs text-cap-muted mt-1">
                    {settings.transitionMode === 'mix'
                      ? `${settings.mixBars}-bar crossfade with tempo slide`
                      : 'Bar-aligned switch with 1-beat fade'}
                  </p>
                </div>

                {/* Tempo Lock Toggle */}
                <div className="px-4 py-2 border-b border-cap-border">
                  <button
                    onClick={() => onSettingsChange({ fixTempo: !settings.fixTempo })}
                    aria-pressed={settings.fixTempo}
                    role="menuitemcheckbox"
                    className={`
                      flex items-center gap-3 w-full px-4 py-2 rounded-lg text-base font-bold transition-colors min-h-[48px]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
                      ${settings.fixTempo 
                        ? 'bg-cap-green-vivid/20 text-cap-green border border-cap-green-deep' 
                        : 'bg-cap-bg text-cap-text-sec border border-cap-border hover:border-cap-muted'}
                    `}
                  >
                    {settings.fixTempo ? <Lock size={18} /> : <Unlock size={18} />}
                    <span>TEMPO LOCK</span>
                    <span className={`ml-auto text-sm ${settings.fixTempo ? 'text-cap-green' : 'text-cap-muted'}`}>
                      {settings.fixTempo ? 'ON' : 'OFF'}
                    </span>
                  </button>
                  <p className="text-xs text-cap-muted mt-1 px-1">
                    {settings.fixTempo
                      ? 'Tracks time-stretch to match target BPM'
                      : 'Tracks play at native speed'}
                  </p>
                </div>

                {/* Mix Duration (1/2/4 bars) */}
                <div className="px-4 py-2 border-b border-cap-border">
                  <label className="text-sm font-semibold text-cap-muted uppercase tracking-wider mb-1.5 block">
                    Mix Duration
                  </label>
                  <div className="flex items-center bg-cap-bg rounded-lg p-1" role="radiogroup" aria-label="Mix duration">
                    {([1, 2, 4] as const).map((bars) => (
                      <button
                        key={bars}
                        onClick={() => onSettingsChange({ mixBars: bars })}
                        aria-checked={settings.mixBars === bars}
                        role="radio"
                        className={`
                          flex-1 px-3 py-2 rounded-md text-base font-bold transition-colors
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
                          ${settings.mixBars === bars
                            ? 'bg-cap-blue-vivid text-cap-paper'
                            : 'text-cap-muted hover:text-cap-text'}
                        `}
                      >
                        {bars} BAR{bars > 1 ? 'S' : ''}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-cap-muted mt-1">
                    Crossfade length for MIX transitions
                  </p>
                </div>

                {/* Auto-Advance Mode */}
                <div className="px-4 py-2 border-b border-cap-border">
                  <label className="text-sm font-semibold text-cap-muted uppercase tracking-wider mb-1.5 block">
                    When Queue Ends
                  </label>
                  <div className="flex items-center bg-cap-bg rounded-lg p-1" role="radiogroup" aria-label="Auto-advance mode">
                    {([
                      { value: 'tempo-asc' as const, label: 'BPM ↑' },
                      { value: 'tempo-desc' as const, label: 'BPM ↓' },
                      { value: 'stop' as const, label: 'STOP' },
                    ]).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => onSettingsChange({ autoAdvanceMode: value })}
                        role="radio"
                        aria-checked={settings.autoAdvanceMode === value}
                        className={`
                          flex-1 px-3 py-2 rounded-md text-base font-bold transition-colors min-h-[48px]
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
                          ${settings.autoAdvanceMode === value
                            ? 'bg-cap-blue-vivid text-cap-paper'
                            : 'text-cap-muted hover:text-cap-text'}
                        `}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Queue — two-step confirmation (Nielsen #5: error prevention) */}
                {onClearQueue && (
                  <ClearQueueButton onClearQueue={onClearQueue} onClose={() => setIsSettingsOpen(false)} />
                )}

                {/* Theme Toggle */}
                <div className="px-4 py-2 border-t border-cap-border">
                  <button
                    onClick={toggleTheme}
                    role="menuitem"
                    className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-base font-bold transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
                      bg-cap-bg text-cap-text-sec border border-cap-border hover:border-cap-muted"
                  >
                    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    <span>{theme === 'light' ? 'DARK MODE' : 'LIGHT MODE'}</span>
                    <span className="ml-auto text-sm text-cap-muted">{theme.toUpperCase()}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive BPM Button — click to type, drag to adjust */}
          {isEditingBpm ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="60"
                max="200"
                value={editBpmValue}
                onChange={(e) => setEditBpmValue(e.target.value)}
                onKeyDown={handleBpmKeyDown}
                onBlur={handleBpmSubmit}
                autoFocus
                className="w-16 px-2 py-1 text-lg font-mono font-bold text-cap-yellow
                           bg-cap-surface border border-cap-yellow rounded text-center"
              />
              <span className="text-sm font-bold text-cap-yellow">BPM</span>
            </div>
          ) : (
            <button
              onClick={handleBpmClick}
              onMouseDown={handleBpmDragStart}
              aria-label={`Current BPM: ${Math.round(transportState.currentBpm)}. Click to edit, drag to adjust.`}
              className={`
                flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono font-bold transition-colors min-h-[48px]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
                cursor-ns-resize select-none
                ${settings.fixTempo
                  ? 'bg-cap-green-vivid/20 text-cap-green border border-cap-green-deep'
                  : 'bg-cap-btn text-cap-yellow hover:bg-cap-btn-hover'}
              `}
            >
              {settings.fixTempo && <Lock size={16} />}
              <span className="text-lg">{Math.round(transportState.currentBpm)}</span>
              <span className="text-xs uppercase">BPM</span>
            </button>
          )}

          {/* TALK Toggle — duck music for session leader to speak */}
          <button
            onClick={() => onSettingsChange({ duckOn: !settings.duckOn })}
            aria-pressed={settings.duckOn}
            aria-label={settings.duckOn ? 'Talk mode on – music ducked' : 'Talk mode off – full volume'}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-lg font-bold transition-colors min-h-[48px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              ${settings.duckOn
                ? 'bg-cap-gold-vivid text-cap-ink'
                : 'bg-cap-btn text-cap-text-sec hover:bg-cap-btn-hover'}
            `}
          >
            {settings.duckOn ? <VolumeX size={20} /> : <Mic size={20} />}
            <span className="hidden sm:inline">TALK</span>
          </button>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-2">
          {/* BACK Button - restart current track */}
          <button
            onClick={onRewind}
            disabled={transportState.phase === 'idle'}
            aria-label="Rewind to start of current track"
            className={`
              flex items-center gap-2 px-4 py-2 text-lg font-bold rounded-xl transition-colors min-h-[48px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              ${transportState.phase === 'idle'
                ? 'bg-cap-btn text-cap-disabled cursor-not-allowed'
                : 'bg-cap-btn hover:bg-cap-btn-hover text-cap-text'
              }
            `}
          >
            <SkipBack size={20} />
            <span className="hidden sm:inline">BACK</span>
          </button>

          {/* NEXT Button - trigger queued track */}
          <button
            onClick={onTriggerNext}
            disabled={!hasQueuedTrack || transportState.phase === 'mixing'}
            aria-label="Skip to next queued track"
            className={`
              flex items-center gap-2 px-4 py-2 text-lg font-bold rounded-xl transition-colors min-h-[48px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              ${!hasQueuedTrack || transportState.phase === 'mixing'
                ? 'bg-cap-btn text-cap-disabled cursor-not-allowed'
                : 'bg-cap-blue-vivid hover:bg-cap-blue-vivid/80 text-cap-paper'
              }
            `}
          >
            <SkipForward size={20} />
            NEXT
          </button>

          {/* Play/Pause Toggle */}
          <button
            onClick={onTogglePause}
            disabled={transportState.phase === 'idle'}
            aria-label={transportState.isPaused ? 'Resume playback' : 'Pause playback'}
            className={`
              flex items-center gap-2 px-5 py-2 text-lg font-bold rounded-xl transition-colors min-h-[48px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              ${transportState.phase === 'idle'
                ? 'bg-cap-btn text-cap-disabled cursor-not-allowed'
                : transportState.isPaused
                  ? 'bg-cap-green-vivid hover:bg-cap-green-vivid/80 text-cap-paper'
                  : 'bg-cap-gold-vivid hover:bg-cap-gold-vivid/80 text-cap-ink'
              }
            `}
          >
            {transportState.isPaused ? <Play size={20} /> : <Pause size={20} />}
            {transportState.isPaused ? 'PLAY' : 'PAUSE'}
          </button>
        </div>
      </div>
    </nav>
  );
}

/**
 * Two-step Clear Queue button — first click shows "Confirm?",
 * second click actually clears. Resets after 2s (Nielsen #5: error prevention).
 */
function ClearQueueButton({ onClearQueue, onClose }: { onClearQueue: () => void; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (confirming) {
      onClearQueue();
      onClose();
      setConfirming(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 2000);
    }
  }, [confirming, onClearQueue, onClose]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="px-4 py-2">
      <button
        onClick={handleClick}
        role="menuitem"
        className={`
          flex items-center gap-3 w-full px-4 py-2 rounded-lg text-base font-bold min-h-[48px]
          transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
          ${confirming
            ? 'text-cap-paper bg-cap-red-vivid border border-cap-red'
            : 'text-cap-red bg-cap-bg border border-cap-border hover:border-cap-red hover:bg-cap-burgundy-vivid/20'}
        `}
      >
        <Trash2 size={18} />
        <span>{confirming ? 'TAP TO CONFIRM' : 'CLEAR QUEUE'}</span>
      </button>
    </div>
  );
}
