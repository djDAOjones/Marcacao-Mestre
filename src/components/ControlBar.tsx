import { Square, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
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
        <div className="text-xl font-mono font-bold text-amber-400">
          {Math.round(transportState.currentBpm)} BPM
        </div>
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
