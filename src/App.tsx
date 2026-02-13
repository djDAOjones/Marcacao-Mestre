import { useState, useEffect, useCallback, useRef } from 'react';
import { ControlBar } from './components/ControlBar';
import { TrackGrid } from './components/TrackGrid';
import { QueuePanel } from './components/QueuePanel';
import { LibraryUpload } from './components/LibraryUpload';
import { dualDeckEngine, type TransportState } from './lib/dualDeckEngine';
import {
  saveSession,
  restoreSession,
  appendHistory,
  type HistoryEntry,
} from './lib/sessionPersistence';
import type { Library, Track, AppSettings, AutoAdvanceMode } from './types';
import { getNativeBpm } from './lib/beatScheduler';

const DEFAULT_SETTINGS: AppSettings = {
  transitionMode: 'mix',
  fixTempo: false,
  targetBpm: 120,
  mixBars: 2,
  duckOn: false,
  duckLevel: 0.18,
  autoAdvanceMode: 'next',
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
  const [playHistory, setPlayHistory] = useState<HistoryEntry[]>([]);

  // Refs so the auto-advance callback always has the latest values
  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = tracks;
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  // Track the last-known current track ID to detect track changes for history
  const lastCurrentTrackIdRef = useRef<string | null>(null);

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
      mixBars: settings.mixBars,
    });
  }, [settings.transitionMode, settings.duckLevel, settings.fixTempo, settings.mixBars]);

  useEffect(() => {
    dualDeckEngine.setFixTempo(settings.fixTempo);
  }, [settings.fixTempo]);

  useEffect(() => {
    dualDeckEngine.setTargetBpm(settings.targetBpm);
  }, [settings.targetBpm]);

  // Auto-advance: when queue empties while playing, pick next track per mode
  useEffect(() => {
    dualDeckEngine.setOnTrackEnded(() => {
      const allTracks = tracksRef.current;
      const mode: AutoAdvanceMode = settingsRef.current.autoAdvanceMode;
      if (allTracks.length === 0 || mode === 'stop') return;

      const currentTrack = dualDeckEngine.getCurrentTrack();
      const currentIndex = currentTrack
        ? allTracks.findIndex(t => t.id === currentTrack.id)
        : -1;

      let nextTrack: Track | undefined;

      switch (mode) {
        case 'random': {
          // Pick a random track that isn't the current one
          const candidates = allTracks.filter(t => t.id !== currentTrack?.id);
          nextTrack = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : allTracks[0];
          break;
        }
        case 'tempo-asc': {
          // Sort by BPM ascending, pick next one above current
          const sorted = [...allTracks].sort(
            (a, b) => getNativeBpm(a.beatMap) - getNativeBpm(b.beatMap),
          );
          const curBpm = currentTrack ? getNativeBpm(currentTrack.beatMap) : 0;
          nextTrack = sorted.find(t => getNativeBpm(t.beatMap) > curBpm && t.id !== currentTrack?.id)
            ?? sorted[0]; // wrap to slowest
          break;
        }
        case 'tempo-desc': {
          // Sort by BPM descending, pick next one below current
          const sorted = [...allTracks].sort(
            (a, b) => getNativeBpm(b.beatMap) - getNativeBpm(a.beatMap),
          );
          const curBpm = currentTrack ? getNativeBpm(currentTrack.beatMap) : Infinity;
          nextTrack = sorted.find(t => getNativeBpm(t.beatMap) < curBpm && t.id !== currentTrack?.id)
            ?? sorted[0]; // wrap to fastest
          break;
        }
        case 'next':
        default: {
          // Next in library order, wrapping
          const nextIndex = (currentIndex + 1) % allTracks.length;
          nextTrack = allTracks[nextIndex];
          break;
        }
      }

      if (nextTrack) {
        console.log(`[App] Auto-advance (${mode}): queuing "${nextTrack.name}"`);
        dualDeckEngine.addToQueue(nextTrack, 'end');
      }
    });

    return () => dualDeckEngine.setOnTrackEnded(null);
  }, []);

  const handleLibraryLoaded = useCallback((lib: Library, loadedTracks: Track[]) => {
    setLibrary(lib);
    setTracks(loadedTracks);

    // Restore saved session (queue + history) for this library
    const saved = restoreSession(lib.id, loadedTracks);
    if (saved) {
      setPlayHistory(saved.history);
      // Re-queue saved items
      if (saved.queue.length > 0) {
        for (const item of saved.queue) {
          dualDeckEngine.addToQueue(item.track, 'end');
        }
        console.log(`[App] Restored ${saved.queue.length} queued tracks from session`);
      }
    }
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

  const handleRewind = useCallback(() => {
    dualDeckEngine.rewind();
  }, []);

  const handleClearQueue = useCallback(() => {
    dualDeckEngine.clearQueue();
  }, []);

  const handleRemoveFromQueue = useCallback((itemId: string) => {
    dualDeckEngine.removeFromQueue(itemId);
  }, []);

  const handleReorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    dualDeckEngine.reorderQueue(fromIndex, toIndex);
  }, []);

  // ---------- Session persistence ----------

  // Record play history when the current track changes
  useEffect(() => {
    const currentId = transportState.currentTrack?.id ?? null;
    if (currentId && currentId !== lastCurrentTrackIdRef.current) {
      setPlayHistory(prev => appendHistory(prev, transportState.currentTrack!));
    }
    lastCurrentTrackIdRef.current = currentId;
  }, [transportState.currentTrack]);

  // Debounced save of queue + history whenever they change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!library) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSession(
        library.id,
        transportState.queue,
        transportState.currentTrack?.id ?? null,
        playHistory,
      );
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [library, transportState.queue, transportState.currentTrack, playHistory]);

  // Derive queued track IDs for highlighting in the grid
  const queuedTrackIds = transportState.queue.map(q => q.track.id);

  if (!library) {
    return <LibraryUpload onLibraryLoaded={handleLibraryLoaded} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="fixed bottom-2 right-2 text-xs text-cap-disabled bg-cap-panel/80 px-2 py-1 rounded z-50">
        v{import.meta.env.VITE_APP_VERSION}
      </div>
      <ControlBar
        transportState={transportState}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onTogglePause={handleTogglePause}
        onTriggerNext={handleTriggerNext}
        onRewind={handleRewind}
        onClearQueue={handleClearQueue}
      />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <TrackGrid
            tracks={tracks}
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
          playHistory={playHistory}
        />
      </div>
    </div>
  );
}

export default App;
