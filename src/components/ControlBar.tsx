import { Square, Volume2, VolumeX } from 'lucide-react';
import type { AppSettings } from '../types';

interface ControlBarProps {
  currentTrackName: string | null;
  currentBpm: number;
  isPlaying: boolean;
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onStop: () => void;
}

export function ControlBar({
  currentTrackName,
  currentBpm,
  isPlaying,
  settings,
  onSettingsChange,
  onStop,
}: ControlBarProps) {
  const mixLengths: Array<4 | 8 | 16> = [4, 8, 16];

  return (
    <div className="bg-gray-900 border-b border-gray-700">
      {/* Transport Status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 text-sm">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-gray-500 mr-2">NOW:</span>
            <span className="font-medium">{currentTrackName ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 mr-2">STATUS:</span>
            <span className={isPlaying ? 'text-green-400' : 'text-gray-400'}>
              {isPlaying ? 'PLAYING' : 'STOPPED'}
            </span>
          </div>
        </div>
        <div className="text-xl font-mono font-bold text-amber-400">
          {Math.round(currentBpm)} BPM
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
  );
}
