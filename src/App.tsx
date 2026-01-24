import { useState, useEffect, useCallback } from 'react';
import { ControlBar } from './components/ControlBar';
import { TrackGrid } from './components/TrackGrid';
import { LibraryUpload } from './components/LibraryUpload';
import { audioEngine } from './lib/audioEngine';
import type { Library, Track, AppSettings } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  quantiseOn: false,
  mixLengthBars: 8,
  duckOn: false,
  duckLevel: 0.18,
};

function App() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(120);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const currentTrack = tracks.find(t => t.id === currentTrackId);

  useEffect(() => {
    let animationId: number;

    const updateState = () => {
      setIsPlaying(audioEngine.getIsPlaying());
      setCurrentBpm(audioEngine.getCurrentBpm());
      animationId = requestAnimationFrame(updateState);
    };

    updateState();
    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    audioEngine.setDuck(settings.duckOn);
  }, [settings.duckOn]);

  const handleLibraryLoaded = useCallback((lib: Library, loadedTracks: Track[]) => {
    setLibrary(lib);
    setTracks(loadedTracks);
  }, []);

  const handleTrackSelect = useCallback(async (track: Track) => {
    try {
      await audioEngine.resume();
      await audioEngine.loadTrack(track);
      audioEngine.play();
      setCurrentTrackId(track.id);
    } catch (err) {
      console.error('Failed to play track:', err);
    }
  }, []);

  const handleStop = useCallback(() => {
    audioEngine.stop();
    setCurrentTrackId(null);
  }, []);

  const handleSettingsChange = useCallback((changes: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...changes }));
  }, []);

  if (!library) {
    return <LibraryUpload onLibraryLoaded={handleLibraryLoaded} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ControlBar
        currentTrackName={currentTrack?.name ?? null}
        currentBpm={currentBpm}
        isPlaying={isPlaying}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onStop={handleStop}
      />
      <main className="flex-1 overflow-auto">
        <TrackGrid
          tracks={tracks}
          columns={library.gridColumns}
          currentTrackId={currentTrackId}
          onTrackSelect={handleTrackSelect}
        />
      </main>
    </div>
  );
}

export default App;
