import { useState, useEffect, useCallback, useRef } from 'react';
import { ControlBar } from './components/ControlBar';
import { TrackGrid } from './components/TrackGrid';
import { QueuePanel } from './components/QueuePanel';
import { LibraryUpload } from './components/LibraryUpload';
import { dualDeckEngine, type TransportState } from './lib/dualDeckEngine';
import type { Library, Track, AppSettings } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  transitionMode: 'mix',
  fixTempo: false,
  targetBpm: 120,
  duckOn: false,
  duckLevel: 0.18,
};

function App() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [transportState, setTransportState] = useState<TransportState>({
    phase: 'idle',
    currentTrack: null,
    nextTrack: null,
    queue: [],
    currentBpm: 120,
    targetBpm: 120,
    mixProgress: 0,
    transitionMode: 'mix',
    beatPosition: null,
    isPaused: false,
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Ref to tracks so the auto-advance callback always has the latest list
  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = tracks;

  useEffect(() => {
    let animationId: number;

    const updateState = () => {
      setTransportState(dualDeckEngine.getTransportState());
      animationId = requestAnimationFrame(updateState);
    };

    updateState();
    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    dualDeckEngine.setDuck(settings.duckOn);
  }, [settings.duckOn]);

  useEffect(() => {
    dualDeckEngine.setConfig({
      transitionMode: settings.transitionMode,
      duckLevel: settings.duckLevel,
      fixTempo: settings.fixTempo,
    });
  }, [settings.transitionMode, settings.duckLevel, settings.fixTempo]);

  useEffect(() => {
    dualDeckEngine.setFixTempo(settings.fixTempo);
  }, [settings.fixTempo]);

  useEffect(() => {
    dualDeckEngine.setTargetBpm(settings.targetBpm);
  }, [settings.targetBpm]);

  // Auto-advance: when queue empties while playing, add next library track
  useEffect(() => {
    dualDeckEngine.setOnTrackEnded(() => {
      const allTracks = tracksRef.current;
      if (allTracks.length === 0) return;

      const currentTrack = dualDeckEngine.getCurrentTrack();
      const currentIndex = currentTrack
        ? allTracks.findIndex(t => t.id === currentTrack.id)
        : -1;

      // Pick the next track in library order, wrapping to the start
      const nextIndex = (currentIndex + 1) % allTracks.length;
      const nextTrack = allTracks[nextIndex];
      if (nextTrack) {
        console.log(`[App] Auto-advance: queuing "${nextTrack.name}"`);
        dualDeckEngine.addToQueue(nextTrack, 'end');
      }
    });

    return () => dualDeckEngine.setOnTrackEnded(null);
  }, []);

  const handleLibraryLoaded = useCallback((lib: Library, loadedTracks: Track[]) => {
    setLibrary(lib);
    setTracks(loadedTracks);
  }, []);

  // Single click: add to end of queue (or play immediately if nothing playing)
  const handleSingleClick = useCallback(async (track: Track) => {
    try {
      await dualDeckEngine.resume();
      if (transportState.phase === 'idle') {
        await dualDeckEngine.loadAndPlayTrack(track);
      } else {
        dualDeckEngine.addToQueue(track, 'end');
      }
    } catch (err) {
      console.error('Failed to handle track:', err);
    }
  }, [transportState.phase]);

  // Double click: insert as next in queue
  const handleDoubleClick = useCallback(async (track: Track) => {
    try {
      await dualDeckEngine.resume();
      if (transportState.phase === 'idle') {
        await dualDeckEngine.loadAndPlayTrack(track);
      } else {
        dualDeckEngine.addToQueue(track, 'next');
      }
    } catch (err) {
      console.error('Failed to handle track:', err);
    }
  }, [transportState.phase]);

  // Triple click: immediate 2-bar mix, queue resumes after
  const handleTripleClick = useCallback(async (track: Track) => {
    try {
      await dualDeckEngine.resume();
      await dualDeckEngine.mixTrackImmediately(track);
    } catch (err) {
      console.error('Failed to handle track:', err);
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    dualDeckEngine.togglePause();
  }, []);

  const handleSettingsChange = useCallback((changes: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...changes }));
  }, []);

  const handleTriggerNext = useCallback(() => {
    dualDeckEngine.triggerNext();
  }, []);

  const handleRemoveFromQueue = useCallback((itemId: string) => {
    dualDeckEngine.removeFromQueue(itemId);
  }, []);

  const handleReorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    dualDeckEngine.reorderQueue(fromIndex, toIndex);
  }, []);

  // Derive queued track IDs for highlighting in the grid
  const queuedTrackIds = transportState.queue.map(q => q.track.id);

  if (!library) {
    return <LibraryUpload onLibraryLoaded={handleLibraryLoaded} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="fixed bottom-2 right-2 text-xs text-gray-500 bg-gray-900/80 px-2 py-1 rounded z-50">
        v{import.meta.env.VITE_APP_VERSION}
      </div>
      <ControlBar
        transportState={transportState}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onTogglePause={handleTogglePause}
        onTriggerNext={handleTriggerNext}
      />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-auto">
          <TrackGrid
            tracks={tracks}
            columns={library.gridColumns}
            currentTrackId={transportState.currentTrack?.id ?? null}
            queuedTrackId={transportState.nextTrack?.id ?? null}
            queuedTrackIds={queuedTrackIds}
            mixProgress={transportState.mixProgress}
            onSingleClick={handleSingleClick}
            onDoubleClick={handleDoubleClick}
            onTripleClick={handleTripleClick}
          />
        </main>
        <QueuePanel
          currentTrack={transportState.currentTrack}
          nextTrack={transportState.nextTrack}
          queue={transportState.queue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onReorder={handleReorderQueue}
        />
      </div>
    </div>
  );
}

export default App;
