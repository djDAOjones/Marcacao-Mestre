import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Pause, Play, SkipBack, SkipForward,
  Volume2, VolumeX, Lock, Unlock,
  Settings, Trash2, Sun, Moon,
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
 * ControlBar — Main playback control strip.
 *
 * Layout (left → right):
 *   Status bar:  NOW | NEXT | STATUS | BPM
 *   Controls:    [Duck] [Settings ▾]  ...spacer...  [⏮] [⏭ NEXT] [⏯ PLAY/PAUSE]
 *
 * The Settings dropdown contains less-used controls:
 *   - MIX / CUT transition toggle
 *   - Tempo Lock toggle
 *   - Clear Queue action
 *
 * Design: IBM Carbon button sizes (56px min-height), WCAG AAA focus rings,
 *         Nielsen #8 (minimalist), #6 (recognition > recall).
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

  const getStatusText = () => {
    switch (transportState.phase) {
      case 'idle': return 'STOPPED';
      case 'playing': return transportState.isPaused ? 'PAUSED' : 'PLAYING';
      case 'queued': return 'QUEUED';
      case 'mixing': 
        const progress = Math.round(transportState.mixProgress * 100);
        return `MIXING ${progress}%`;
    }
  };

  const getStatusColor = () => {
    switch (transportState.phase) {
      case 'idle': return 'text-cap-muted';
      case 'playing': return transportState.isPaused ? 'text-cap-yellow' : 'text-cap-green';
      case 'queued': return 'text-cap-gold';
      case 'mixing': return 'text-cap-flag';
    }
  };

  const { theme, toggleTheme } = useTheme();
  const hasQueuedTrack = transportState.nextTrack !== null || transportState.phase === 'queued';

  return (
    <nav className="bg-cap-panel border-b border-cap-border" role="toolbar" aria-label="Playback controls">
      {/* Transport Status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cap-border-sub text-base" role="status" aria-live="polite">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-cap-muted mr-2">NOW:</span>
            <span className="font-medium">{transportState.currentTrack?.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-cap-muted mr-2">NEXT:</span>
            <span className="font-medium text-cap-yellow">{transportState.nextTrack?.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-cap-muted mr-2">STATUS:</span>
            <span className={getStatusColor()}>
              {getStatusText()}
            </span>
          </div>
        </div>
        {/* Interactive BPM Display */}
        {isEditingBpm ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="60"
              max="200"
              value={editBpmValue}
              onChange={(e) => setEditBpmValue(e.target.value)}
              onKeyDown={handleBpmKeyDown}
              onBlur={handleBpmSubmit}
              autoFocus
              className="w-20 px-2 py-1 text-xl font-mono font-bold text-cap-yellow 
                         bg-cap-surface border border-cap-yellow rounded text-center"
            />
            <span className="text-xl font-mono font-bold text-cap-yellow">BPM</span>
          </div>
        ) : (
          <div
            onClick={handleBpmClick}
            onMouseDown={handleBpmDragStart}
            className={`text-xl font-mono font-bold cursor-ns-resize select-none
                       ${settings.fixTempo ? 'text-cap-green' : 'text-cap-yellow'}`}
            title="Click to edit, drag to adjust"
          >
            {Math.round(transportState.currentBpm)} BPM
            {settings.fixTempo && <span className="text-sm ml-1">🔒</span>}
          </div>
        )}
      </div>

      {/* Controls - Large buttons for tablet tapping */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-4">
          {/* Duck Toggle — always visible (frequent use during class) */}
          <button
            onClick={() => onSettingsChange({ duckOn: !settings.duckOn })}
            aria-pressed={settings.duckOn}
            aria-label={settings.duckOn ? 'Duck on – volume reduced' : 'Duck off – full volume'}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-bold transition-colors min-h-[56px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              ${settings.duckOn 
                ? 'bg-cap-gold-vivid text-cap-ink' 
                : 'bg-cap-btn text-cap-text-sec'}
            `}
          >
            {settings.duckOn ? <VolumeX size={24} /> : <Volume2 size={24} />}
            DUCK
          </button>

          {/* Settings Dropdown — contains MIX/CUT, Tempo Lock, Clear Queue */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(prev => !prev)}
              aria-expanded={isSettingsOpen}
              aria-haspopup="menu"
              aria-label="Settings menu"
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-bold transition-colors min-h-[56px]
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
                <div className="px-4 py-3 border-b border-cap-border">
                  <label className="text-sm font-semibold text-cap-muted uppercase tracking-wider mb-2 block">
                    Transition Mode
                  </label>
                  <div className="flex items-center bg-cap-bg rounded-lg p-1">
                    <button
                      onClick={() => onSettingsChange({ transitionMode: 'mix' })}
                      aria-pressed={settings.transitionMode === 'mix'}
                      role="menuitemradio"
                      className={`
                        flex-1 px-4 py-2 rounded-md text-base font-bold transition-colors
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
                      aria-pressed={settings.transitionMode === 'cut'}
                      role="menuitemradio"
                      className={`
                        flex-1 px-4 py-2 rounded-md text-base font-bold transition-colors
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
                      ? '2-bar crossfade with tempo slide'
                      : 'Instant switch at next bar'}
                  </p>
                </div>

                {/* Tempo Lock Toggle */}
                <div className="px-4 py-3 border-b border-cap-border">
                  <button
                    onClick={() => onSettingsChange({ fixTempo: !settings.fixTempo })}
                    aria-pressed={settings.fixTempo}
                    role="menuitemcheckbox"
                    className={`
                      flex items-center gap-3 w-full px-4 py-2 rounded-lg text-base font-bold transition-colors
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

                {/* Clear Queue — two-step confirmation (Nielsen #5: error prevention) */}
                {onClearQueue && (
                  <ClearQueueButton onClearQueue={onClearQueue} onClose={() => setIsSettingsOpen(false)} />
                )}

                {/* Theme Toggle */}
                <div className="px-4 py-3 border-t border-cap-border">
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
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-3">
          {/* REWIND Button - restart current track */}
          <button
            onClick={onRewind}
            disabled={transportState.phase === 'idle'}
            aria-label="Rewind to start of current track"
            className={`
              flex items-center gap-2 px-6 py-3 text-lg font-bold rounded-xl transition-colors min-h-[56px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              ${transportState.phase === 'idle'
                ? 'bg-cap-btn text-cap-disabled cursor-not-allowed'
                : 'bg-cap-btn hover:bg-cap-btn-hover text-cap-text'
              }
            `}
          >
            <SkipBack size={24} />
            BACK
          </button>

          {/* NEXT Button - trigger queued track */}
          <button
            onClick={onTriggerNext}
            disabled={!hasQueuedTrack || transportState.phase === 'mixing'}
            aria-label="Skip to next queued track"
            className={`
              flex items-center gap-2 px-6 py-3 text-lg font-bold rounded-xl transition-colors min-h-[56px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              ${!hasQueuedTrack || transportState.phase === 'mixing'
                ? 'bg-cap-btn text-cap-disabled cursor-not-allowed'
                : 'bg-cap-blue-vivid hover:bg-cap-blue-vivid/80 text-cap-paper'
              }
            `}
          >
            <SkipForward size={24} />
            NEXT
          </button>

          {/* Play/Pause Toggle */}
          <button
            onClick={onTogglePause}
            disabled={transportState.phase === 'idle'}
            aria-label={transportState.isPaused ? 'Resume playback' : 'Pause playback'}
            className={`
              flex items-center gap-2 px-6 py-3 text-lg font-bold rounded-xl transition-colors min-h-[56px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              ${transportState.phase === 'idle'
                ? 'bg-cap-btn text-cap-disabled cursor-not-allowed'
                : transportState.isPaused
                  ? 'bg-cap-green-vivid hover:bg-cap-green-vivid/80 text-cap-paper'
                  : 'bg-cap-gold-vivid hover:bg-cap-gold-vivid/80 text-cap-ink'
              }
            `}
          >
            {transportState.isPaused ? <Play size={24} /> : <Pause size={24} />}
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
    <div className="px-4 py-3">
      <button
        onClick={handleClick}
        role="menuitem"
        className={`
          flex items-center gap-3 w-full px-4 py-2 rounded-lg text-base font-bold
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
