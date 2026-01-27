import { useState, useRef, useCallback } from 'react';
import { Square, Pause, Play, SkipForward, Volume2, VolumeX, Lock, Unlock } from 'lucide-react';
import type { AppSettings } from '../types';
import type { TransportState } from '../lib/dualDeckEngine';

export interface ControlBarProps {
  transportState: TransportState;
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onStop: () => void;
  onTogglePause: () => void;
  onTriggerNext: () => void;
}

export function ControlBar({
  transportState,
  settings,
  onSettingsChange,
  onStop,
  onTogglePause,
  onTriggerNext,
}: ControlBarProps) {
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [editBpmValue, setEditBpmValue] = useState('');
  const dragStartY = useRef<number | null>(null);
  const dragStartBpm = useRef<number>(120);

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
      const deltaBpm = Math.round(deltaY * 0.5); // 0.5 BPM per pixel
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
    <div className="bg-gray-900 border-b border-gray-700">
      {/* Transport Status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 text-sm">
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
          {/* Transition Mode Toggle: MIX / CUT */}
          <div className="flex items-center bg-gray-800 rounded-xl p-1.5">
            <button
              onClick={() => onSettingsChange({ transitionMode: 'mix' })}
              className={`
                px-6 py-3 rounded-lg text-lg font-bold transition-colors min-h-[56px]
                ${settings.transitionMode === 'mix' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'}
              `}
            >
              MIX
            </button>
            <button
              onClick={() => onSettingsChange({ transitionMode: 'cut' })}
              className={`
                px-6 py-3 rounded-lg text-lg font-bold transition-colors min-h-[56px]
                ${settings.transitionMode === 'cut' 
                  ? 'bg-orange-600 text-white' 
                  : 'text-gray-400 hover:text-white'}
              `}
            >
              CUT
            </button>
          </div>

          {/* Tempo Lock Toggle */}
          <button
            onClick={() => onSettingsChange({ fixTempo: !settings.fixTempo })}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-bold transition-colors min-h-[56px]
              ${settings.fixTempo 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-300'}
            `}
            title={settings.fixTempo ? 'Tempo locked - tracks time-stretch to match' : 'Native tempo - tracks play at original speed'}
          >
            {settings.fixTempo ? <Lock size={24} /> : <Unlock size={24} />}
            TEMPO
          </button>

          {/* Duck Toggle */}
          <button
            onClick={() => onSettingsChange({ duckOn: !settings.duckOn })}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-bold transition-colors min-h-[56px]
              ${settings.duckOn 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-700 text-gray-300'}
            `}
          >
            {settings.duckOn ? <VolumeX size={24} /> : <Volume2 size={24} />}
            DUCK
          </button>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-3">
          {/* NEXT Button - trigger queued track */}
          <button
            onClick={onTriggerNext}
            disabled={!hasQueuedTrack || transportState.phase === 'mixing'}
            className={`
              flex items-center gap-2 px-6 py-3 text-lg font-bold rounded-xl transition-colors min-h-[56px]
              ${!hasQueuedTrack || transportState.phase === 'mixing'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
              }
            `}
          >
            <SkipForward size={24} />
            NEXT
          </button>

          {/* Pause/Resume Button */}
          <button
            onClick={onTogglePause}
            disabled={transportState.phase === 'idle'}
            className={`
              flex items-center gap-2 px-6 py-3 text-lg font-bold rounded-xl transition-colors min-h-[56px]
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

          {/* Stop Button */}
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 
                       text-white text-lg font-bold rounded-xl transition-colors min-h-[56px]"
          >
            <Square size={24} fill="currentColor" />
            STOP
          </button>
        </div>
      </div>
    </div>
  );
}
