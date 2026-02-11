import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Pause, Play, SkipBack, SkipForward,
  Volume2, VolumeX, Lock, Unlock,
  Settings, Trash2,
} from 'lucide-react';
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
      case 'idle': return 'text-gray-400';
      case 'playing': return transportState.isPaused ? 'text-yellow-400' : 'text-green-400';
      case 'queued': return 'text-amber-400';
      case 'mixing': return 'text-blue-400';
    }
  };

  const hasQueuedTrack = transportState.nextTrack !== null || transportState.phase === 'queued';

  return (
    <nav className="bg-gray-900 border-b border-gray-700" role="toolbar" aria-label="Playback controls">
      {/* Transport Status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 text-sm" role="status" aria-live="polite">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-gray-500 mr-2">NOW:</span>
            <span className="font-medium">{transportState.currentTrack?.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 mr-2">NEXT:</span>
            <span className="font-medium text-amber-400">{transportState.nextTrack?.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 mr-2">STATUS:</span>
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
              className="w-20 px-2 py-1 text-xl font-mono font-bold text-amber-400 
                         bg-gray-800 border border-amber-400 rounded text-center"
            />
            <span className="text-xl font-mono font-bold text-amber-400">BPM</span>
          </div>
        ) : (
          <div
            onClick={handleBpmClick}
            onMouseDown={handleBpmDragStart}
            className={`text-xl font-mono font-bold cursor-ns-resize select-none
                       ${settings.fixTempo ? 'text-green-400' : 'text-amber-400'}`}
            title="Click to edit, drag to adjust"
          >
            {Math.round(transportState.currentBpm)} BPM
            {settings.fixTempo && <span className="text-xs ml-1">🔒</span>}
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
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
              ${settings.duckOn 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-700 text-gray-300'}
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
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                ${isSettingsOpen
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
              `}
            >
              <Settings size={24} />
              <span className="hidden sm:inline">SETTINGS</span>
            </button>

            {isSettingsOpen && (
              <div
                className="absolute top-full left-0 mt-2 w-72 bg-gray-800 border border-gray-600 rounded-xl shadow-xl z-50 overflow-hidden"
                role="menu"
                aria-label="Settings"
              >
                {/* MIX / CUT Toggle */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Transition Mode
                  </label>
                  <div className="flex items-center bg-gray-900 rounded-lg p-1">
                    <button
                      onClick={() => onSettingsChange({ transitionMode: 'mix' })}
                      aria-pressed={settings.transitionMode === 'mix'}
                      role="menuitemradio"
                      className={`
                        flex-1 px-4 py-2 rounded-md text-sm font-bold transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                        ${settings.transitionMode === 'mix' 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-400 hover:text-white'}
                      `}
                    >
                      MIX
                    </button>
                    <button
                      onClick={() => onSettingsChange({ transitionMode: 'cut' })}
                      aria-pressed={settings.transitionMode === 'cut'}
                      role="menuitemradio"
                      className={`
                        flex-1 px-4 py-2 rounded-md text-sm font-bold transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                        ${settings.transitionMode === 'cut' 
                          ? 'bg-orange-600 text-white' 
                          : 'text-gray-400 hover:text-white'}
                      `}
                    >
                      CUT
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {settings.transitionMode === 'mix'
                      ? '2-bar crossfade with tempo slide'
                      : 'Instant switch at next bar'}
                  </p>
                </div>

                {/* Tempo Lock Toggle */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <button
                    onClick={() => onSettingsChange({ fixTempo: !settings.fixTempo })}
                    aria-pressed={settings.fixTempo}
                    role="menuitemcheckbox"
                    className={`
                      flex items-center gap-3 w-full px-4 py-2 rounded-lg text-sm font-bold transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                      ${settings.fixTempo 
                        ? 'bg-green-600/20 text-green-400 border border-green-600' 
                        : 'bg-gray-900 text-gray-300 border border-gray-700 hover:border-gray-500'}
                    `}
                  >
                    {settings.fixTempo ? <Lock size={18} /> : <Unlock size={18} />}
                    <span>TEMPO LOCK</span>
                    <span className={`ml-auto text-xs ${settings.fixTempo ? 'text-green-400' : 'text-gray-500'}`}>
                      {settings.fixTempo ? 'ON' : 'OFF'}
                    </span>
                  </button>
                  <p className="text-[10px] text-gray-500 mt-1 px-1">
                    {settings.fixTempo
                      ? 'Tracks time-stretch to match target BPM'
                      : 'Tracks play at native speed'}
                  </p>
                </div>

                {/* Clear Queue */}
                {onClearQueue && (
                  <div className="px-4 py-3">
                    <button
                      onClick={() => { onClearQueue(); setIsSettingsOpen(false); }}
                      role="menuitem"
                      className="
                        flex items-center gap-3 w-full px-4 py-2 rounded-lg text-sm font-bold
                        text-red-400 bg-gray-900 border border-gray-700 hover:border-red-500 hover:bg-red-900/20
                        transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                      "
                    >
                      <Trash2 size={18} />
                      <span>CLEAR QUEUE</span>
                    </button>
                  </div>
                )}
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
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
              ${transportState.phase === 'idle'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
              }
            `}
          >
            <SkipBack size={24} />
          </button>

          {/* NEXT Button - trigger queued track */}
          <button
            onClick={onTriggerNext}
            disabled={!hasQueuedTrack || transportState.phase === 'mixing'}
            aria-label="Skip to next queued track"
            className={`
              flex items-center gap-2 px-6 py-3 text-lg font-bold rounded-xl transition-colors min-h-[56px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
              ${!hasQueuedTrack || transportState.phase === 'mixing'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
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
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
              ${transportState.phase === 'idle'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : transportState.isPaused
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
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
