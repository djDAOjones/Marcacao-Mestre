import { useState, useEffect, useCallback, useRef } from 'react';
import { ControlBar } from './components/ControlBar';
import { TrackGrid } from './components/TrackGrid';
import { QueuePanel } from './components/QueuePanel';
import { LibraryUpload } from './components/LibraryUpload';
import { HelpModal, useFirstVisitHelp } from './components/HelpModal';
import { ToastContainer, useToast } from './components/Toast';
import { ResolutionWarning } from './components/ResolutionWarning';
import { TransportBar } from './components/TransportBar';
import { dualDeckEngine, type TransportState } from './lib/dualDeckEngine';
import {
  saveSession,
  restoreSession,
  appendHistory,
  type HistoryEntry,
} from './lib/sessionPersistence';
import type { Library, Track, AppSettings } from './types';
import { getNativeBpm } from './lib/beatScheduler';

const DEFAULT_SETTINGS: AppSettings = {
  transitionMode: 'mix',
  fixTempo: false,
  targetBpm: 120,
  mixBars: 2,
  duckOn: false,
  duckLevel: 0.18,
  autoAdvanceMode: 'tempo-asc',
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
    currentTime: 0,
    trackDuration: 0,
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [playHistory, setPlayHistory] = useState<HistoryEntry[]>([]);

  // Toast notifications for user-visible error/success feedback (Nielsen #1, #9)
  const { toasts, pushToast, dismissToast } = useToast();

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
      const mode = settingsRef.current.autoAdvanceMode;
      if (allTracks.length === 0 || mode === 'stop') return;

      const currentTrack = dualDeckEngine.getCurrentTrack();
      let nextTrack: Track | undefined;

      switch (mode) {
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
    dualDeckEngine.setLibraryId(lib.id);

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
      pushToast('error', `Failed to play track: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [transportState.phase, pushToast]);

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
      pushToast('error', `Failed to queue track: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [transportState.phase, pushToast]);

  // Triple click: immediate 2-bar mix, queue resumes after
  const handleTripleClick = useCallback(async (track: Track) => {
    try {
      await dualDeckEngine.resume();
      await dualDeckEngine.mixTrackImmediately(track);
    } catch (err) {
      console.error('Failed to handle track:', err);
      pushToast('error', `Failed to mix track: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [pushToast]);

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

  // Click history item to re-queue it (Notes #6)
  const handleRequeueTrack = useCallback((trackId: string) => {
    const track = tracksRef.current.find(t => t.id === trackId);
    if (track) {
      dualDeckEngine.addToQueue(track, 'end');
      pushToast('info', `Added "${track.name}" to queue`);
    } else {
      pushToast('error', 'Track not found in library');
    }
  }, [pushToast]);

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

  // Help modal state — auto-show on first visit (Nielsen #10)
  const { isFirstVisit, markSeen } = useFirstVisitHelp();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Show help on first visit after library loads
  useEffect(() => {
    if (library && isFirstVisit) {
      setIsHelpOpen(true);
    }
  }, [library, isFirstVisit]);

  const handleCloseHelp = useCallback(() => {
    setIsHelpOpen(false);
    markSeen();
  }, [markSeen]);

  if (!library) {
    return <LibraryUpload onLibraryLoaded={handleLibraryLoaded} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <ResolutionWarning />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <HelpModal isOpen={isHelpOpen} onClose={handleCloseHelp} />
      <div className="fixed bottom-2 right-2 flex items-center gap-2 z-50">
        <button
          onClick={() => setIsHelpOpen(true)}
          aria-label="Help"
          title="Help & controls guide"
          className="
            text-xs text-cap-muted hover:text-cap-text
            bg-cap-panel/80 hover:bg-cap-panel
            px-2 py-1 rounded border border-cap-border/50
            transition-colors min-h-[32px] min-w-[32px]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
          "
        >
          ?
        </button>
        <span className="text-xs text-cap-disabled bg-cap-panel/80 px-2 py-1 rounded">
          v{import.meta.env.VITE_APP_VERSION}
        </span>
      </div>
      <ControlBar
        transportState={transportState}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onTogglePause={handleTogglePause}
        onTriggerNext={handleTriggerNext}
        onRewind={handleRewind}
        onClearQueue={handleClearQueue}
        onHint={(msg) => pushToast('info', msg)}
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
          onRequeueTrack={handleRequeueTrack}
        />
      </div>
      <TransportBar
        trackName={transportState.currentTrack?.name ?? null}
        currentTime={transportState.currentTime}
        duration={transportState.trackDuration}
        isPlaying={transportState.phase === 'playing' && !transportState.isPaused}
        isMixing={transportState.phase === 'mixing'}
        onSeek={(pos) => dualDeckEngine.seek(pos)}
      />
    </div>
  );
}

export default App;
