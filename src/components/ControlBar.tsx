import { Square, Pause, Play, Volume2, VolumeX, Minus, Plus } from 'lucide-react';
import type { AppSettings } from '../types';
import type { TransportState } from '../lib/dualDeckEngine';

export interface ControlBarProps {
  transportState: TransportState;
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onStop: () => void;
  onTogglePause: () => void;
  onBpmChange: (bpm: number) => void;
}

export function ControlBar({
  transportState,
  settings,
  onSettingsChange,
  onStop,
  onTogglePause,
  onBpmChange,
}: ControlBarProps) {
  const mixLengths: Array<0 | 1 | 2 | 4 | 8> = [0, 1, 2, 4, 8];
  
  const getStatusText = () => {
    switch (transportState.phase) {
      case 'idle': return 'STOPPED';
      case 'playing': return transportState.isPaused ? 'PAUSED' : 'PLAYING';
      case 'queued': return 'QUEUED';
      case 'mixing': 
        const barsLeft = Math.ceil((1 - transportState.mixProgress) * transportState.mixLengthBars);
        return `MIXING (${barsLeft}/${transportState.mixLengthBars} bars)`;
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
        <div className="flex items-center gap-2">
          {settings.quantiseOn && (
            <>
              <button
                onClick={() => onBpmChange(transportState.targetBpm - 1)}
                className="p-1 rounded bg-gray-700 hover:bg-gray-600"
              >
                <Minus size={16} />
              </button>
              <div className="text-xl font-mono font-bold text-amber-400 min-w-[100px] text-center">
                {Math.round(transportState.targetBpm)} BPM
              </div>
              <button
                onClick={() => onBpmChange(transportState.targetBpm + 1)}
                className="p-1 rounded bg-gray-700 hover:bg-gray-600"
              >
                <Plus size={16} />
              </button>
            </>
          )}
          {!settings.quantiseOn && (
            <div className="text-xl font-mono font-bold text-amber-400">
              {Math.round(transportState.currentBpm)} BPM
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Quantise Toggle */}
          <button
            onClick={() => onSettingsChange({ quantiseOn: !settings.quantiseOn })}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${settings.quantiseOn 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300'}
            `}
          >
            QUANTISE: {settings.quantiseOn ? 'ON' : 'OFF'}
          </button>

          {/* Mix Length */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <span className="text-gray-500 text-sm px-2">MIX:</span>
            {mixLengths.map(len => (
              <button
                key={len}
                onClick={() => onSettingsChange({ mixLengthBars: len })}
                className={`
                  px-3 py-1 rounded text-sm font-medium transition-colors
                  ${settings.mixLengthBars === len 
                    ? 'bg-gray-600 text-white' 
                    : 'text-gray-400 hover:text-white'}
                `}
              >
                {len}
              </button>
            ))}
          </div>

          {/* Duck Toggle */}
          <button
            onClick={() => onSettingsChange({ duckOn: !settings.duckOn })}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${settings.duckOn 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-700 text-gray-300'}
            `}
          >
            {settings.duckOn ? <VolumeX size={18} /> : <Volume2 size={18} />}
            DUCK
          </button>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-2">
          {/* Pause/Resume Button */}
          <button
            onClick={onTogglePause}
            disabled={transportState.phase === 'idle'}
            className={`
              flex items-center gap-2 px-6 py-2 font-bold rounded-lg transition-colors
              ${transportState.phase === 'idle'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : transportState.isPaused
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-500 text-white'
              }
            `}
          >
            {transportState.isPaused ? <Play size={18} /> : <Pause size={18} />}
            {transportState.isPaused ? 'PLAY' : 'PAUSE'}
          </button>

          {/* Stop Button */}
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 
                       text-white font-bold rounded-lg transition-colors"
          >
            <Square size={18} fill="currentColor" />
            STOP
          </button>
        </div>
      </div>
    </div>
  );
}
