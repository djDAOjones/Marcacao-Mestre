# Beat‑Matched Grid Player — Technical Specification v4

## 1. Purpose

A **novice‑friendly, live‑use music player** for Capoeira classes and similar teaching contexts.

Users cue the next song by pressing **large buttons**. The system handles beat matching, tempo transitions, and crossfades automatically, with **minimal settings** and **safe defaults**.

**Pitch is always preserved** during tempo changes.

---

## 2. Platform & Deployment

| Aspect | Decision |
|--------|----------|
| **Platform** | Progressive Web App (PWA) |
| **Target devices** | Old tablets (iPad, Android), desktop browsers |
| **Installation** | "Add to Home Screen" / Install prompt |
| **Offline capable** | Yes — all audio stored locally after upload |
| **Backend** | None required — fully client-side |

### Technical Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React + TypeScript |
| **Audio engine** | Web Audio API + SoundTouchJS for time-stretching |
| **Storage** | IndexedDB (via Dexie.js) for audio + beat maps |
| **PWA** | Workbox service worker |
| **Build** | Vite |
| **Styling** | TailwindCSS (touch-optimised) |

---

## 3. Core Principles

- **One action = one result** (press a button → next song is cued)
- **Minimal controls**, no expert terminology
- **Musical safety first** (quantised starts, predictable transitions)
- **Instructor‑friendly** (instant duck control)
- UI is simple; audio engine does the heavy lifting

---

## 4. Data Model

### 4.1 Track Library Bundle

Users upload a **single ZIP file** containing:

```
library.zip
├── manifest.json          # Track list + grid layout
├── track-001.mp3
├── track-001.mid          # Beat map (MIDI export from Logic Pro)
├── track-002.mp3
├── track-002.mid
└── ...
```

### 4.2 Manifest Format

```json
{
  "name": "Capoeira Set 2024",
  "grid": {
    "columns": 4
  },
  "tracks": [
    {
      "id": "track-001",
      "name": "Paranauê",
      "audio": "track-001.mp3",
      "beatmap": "track-001.mid"
    },
    {
      "id": "track-002", 
      "name": "Zum Zum Zum",
      "audio": "track-002.mp3",
      "beatmap": "track-002.mid"
    }
  ]
}
```

### 4.3 Beat Map Format (MIDI from Logic Pro)

**Logic Pro workflow:**
1. Create project with live recording
2. Enable Flex Time → detect/correct tempo
3. Create empty MIDI region spanning the track
4. Export MIDI file (File → Export → MIDI)

The MIDI file contains:
- **Tempo track** with tempo events (including tempo changes/ramps)
- **Time signature events**
- First tempo event position = **beat one** of the track

**Parsed beat map (internal):**
```typescript
interface BeatMap {
  timeSignature: { numerator: number; denominator: number };
  tempoEvents: Array<{
    tick: number;        // MIDI ticks from start
    bpm: number;         // Tempo at this point
    timeSeconds: number; // Computed absolute time
  }>;
  ticksPerBeat: number;  // From MIDI header (typically 480)
}
```

The app computes:
- Beat positions in seconds
- Bar boundaries
- Instantaneous BPM at any playback position

---

## 5. User Interface

### 5.1 Layout Overview

```
┌─────────────────────────────────────────────────────────────┐
│  [NOW: Paranauê]  [NEXT: —]  [STATUS: PLAYING]   [120 BPM]  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [QUANTISE: ON/OFF]  [MIX: 4|8|16]  [DUCK]     [■ STOP] ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│   │           │  │           │  │           │  │         │ │
│   │  Track 1  │  │  Track 2  │  │  Track 3  │  │ Track 4 │ │
│   │           │  │           │  │           │  │         │ │
│   └───────────┘  └───────────┘  └───────────┘  └─────────┘ │
│                                                             │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│   │           │  │           │  │           │  │         │ │
│   │  Track 5  │  │  Track 6  │  │  Track 7  │  │ Track 8 │ │
│   │           │  │           │  │           │  │         │ │
│   └───────────┘  └───────────┘  └───────────┘  └─────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Top Control Bar

**Large, prominent controls** — buttons should be easily tappable on tablets (minimum 48px height, ideally 56px+).

#### Transport Status (read-only)
- **NOW:** Current track name
- **NEXT:** Queued track (or `—`)
- **STATUS:** `PLAYING` | `QUEUED` | `MIXING (n/X bars)`
- **BPM:** Current effective tempo (always shown)

#### Controls
| Control | Type | Notes |
|---------|------|-------|
| **Transition Mode** | Toggle: MIX / CUT | **MIX** = 2-bar quantised crossfade; **CUT** = bar-aligned instant switch |
| **Duck** | Toggle ON/OFF | Drops to -12 dB over 1000ms with EQ dip |
| **Next** | Button | Initiates transition to queued track immediately |
| **Pause** | Toggle | Global pause with 0.5s fade-down; resume rewinds 1s then fades up 0.5s |
| **Stop** | Button (red) | Panic — instant silence, clears queue |

### 5.3 Track Grid

- **Compact touch targets** (60×60px default, fitting more tracks on screen)
- **Visual states:**

| State | Appearance |
|-------|------------|
| **Idle** | Neutral grey, track name |
| **Queued** | Amber highlight |
| **Playing** | Green highlight + subtle pulse |
| **Disabled** | Greyed out (missing beat map) |
| **Mixing** | Both outgoing (fading green) and incoming (growing green) |

#### Click Behaviour

| Action | Behaviour |
|--------|----------|
| **Single click** | Adds track to end of queue; will mix in using current Mix Length setting |
| **Double click** | Inserts track to next position in queue (plays after current track) |
| **Triple click** | Mixes immediately (starts crossfade on next downbeat with current Mix Length) |

**Notes:**
- If nothing is playing, any click starts playback immediately
- During a mix, clicks queue tracks for after the mix completes
- Queue stores the Mix Length setting at time of click (per-track transition settings)

---

## 6. Transition Behaviour

### 6.1 MIX Mode (Default)

**User mental model:** "Smooth, musical handoff"

| Phase | Behaviour |
|-------|-----------|
| **Cue** | Incoming track queued, waits for next downbeat |
| **Start** | Incoming starts on downbeat at current track's BPM (quantised) |
| **Crossfade** | 2-bar equal-power crossfade with tempo slide to incoming native BPM |
| **End** | Outgoing stops, incoming continues at its native tempo |

- Transition is beat-aligned and musical
- Both tracks slide tempo together during crossfade

### 6.2 CUT Mode

**User mental model:** "Hard cut on the beat"

| Phase | Behaviour |
|-------|-----------|
| **Cue** | Incoming track queued, prepared at outgoing track's tempo |
| **Trigger** | User presses NEXT or track button (triple-click) |
| **Wait** | Engine waits for next bar downbeat |
| **Switch** | 50ms micro-fade at bar onset; incoming starts on its downbeat aligned to outgoing |

- Bar-aligned — cuts on next bar downbeat for musical timing
- Beats aligned — incoming track's downbeat syncs with outgoing's bar onset
- 50ms fade prevents harsh audio artifacts
- Incoming track plays at outgoing track's tempo (beat-matched)

### 6.3 Crossfade Curve

Volume curve: **Equal-power crossfade** (maintains perceived loudness)

| Mode | Duration |
|------|----------|
| MIX | 2 bars (~4 seconds at 120 BPM) |
| CUT | 50ms micro-fade at bar onset |

---

## 7. Audio Engine Architecture

### 7.1 Components

```
┌─────────────────────────────────────────────────────────────┐
│                      AudioContext                           │
│  ┌─────────────┐    ┌─────────────┐    ┌───────────────┐   │
│  │   Deck A    │    │   Deck B    │    │  Master Gain  │   │
│  │ ┌─────────┐ │    │ ┌─────────┐ │    │  (duck ctrl)  │   │
│  │ │ Source  │ │    │ │ Source  │ │    └───────┬───────┘   │
│  │ │ Buffer  │ │    │ │ Buffer  │ │            │           │
│  │ └────┬────┘ │    │ └────┬────┘ │            ▼           │
│  │      │      │    │      │      │    ┌─────────────┐     │
│  │ ┌────┴────┐ │    │ ┌────┴────┐ │    │ Destination │     │
│  │ │ Sound   │ │    │ │ Sound   │ │    │ (speakers)  │     │
│  │ │ Touch   │ │    │ │ Touch   │ │    └─────────────┘     │
│  │ │ Stretch │ │    │ │ Stretch │ │                        │
│  │ └────┬────┘ │    │ └────┬────┘ │                        │
│  │      │      │    │      │      │                        │
│  │ ┌────┴────┐ │    │ ┌────┴────┐ │                        │
│  │ │  Gain   │─┼────┼─│  Gain   │─┼────────────────────►   │
│  │ │ (fade)  │ │    │ │ (fade)  │ │                        │
│  │ └─────────┘ │    │ └─────────┘ │                        │
│  └─────────────┘    └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Time-Stretching

Using **SoundTouchJS** (LGPL, pure JavaScript):
- Real-time pitch-preserving tempo adjustment
- Works in Web Audio via ScriptProcessorNode or AudioWorklet
- Accepts playback rate changes smoothly

### 7.3 Beat Tracking

The engine maintains:
- **Current beat position** (bar.beat.fraction)
- **Current effective BPM** (accounting for tempo map + stretch)
- **Next downbeat time** (for quantised starts)

Scheduler runs on `requestAnimationFrame` + Web Audio clock for accuracy.

---

## 8. Storage & Persistence

### 8.1 IndexedDB Schema (via Dexie.js)

```typescript
interface TrackRecord {
  id: string;
  name: string;
  audioBlob: Blob;
  beatMap: BeatMap;
  duration: number;
}

interface LibraryRecord {
  id: string;
  name: string;
  gridColumns: number;
  trackIds: string[];
  uploadedAt: Date;
}

interface SettingsRecord {
  currentLibraryId: string;
  transitionMode: 'mix' | 'cut';  // MIX = 2-bar quantised crossfade, CUT = bar-aligned instant switch
  duckLevel: number;
}
```

### 8.2 Upload Flow

1. User selects ZIP file via **click or drag-and-drop**
2. App extracts in browser (using JSZip)
3. Validates manifest + parses MIDI beat maps
4. Stores audio blobs + parsed beat maps in IndexedDB
5. Confirms library loaded, displays grid

**Drag-and-drop behaviour:**
- Drop zone highlights on drag-over
- Invalid files show clear error message
- Progress indicator during import

---

## 9. Logic Pro Workflow (Beat Map Creation)

### Step-by-Step

1. **Import live recording** into Logic Pro project
2. **Enable Flex Time** on the track (Flex → Polyphonic or Rhythmic)
3. **Smart Tempo:** File → Project Settings → Smart Tempo
   - Set to "Adapt Project Tempo"
   - Logic analyses and creates tempo map
4. **Verify beat grid** — adjust if needed using Flex markers
5. **Create placeholder MIDI region:**
   - Create empty MIDI track
   - Draw a single-note region from bar 1 to end of track
   - This ensures tempo track exports fully
6. **Export MIDI:** File → Export → Selection as MIDI File
   - Save as `trackname.mid`
7. **Bounce audio:** File → Bounce → Project or Section
   - Format: MP3, 192+ kbps
   - Save as `trackname.mp3`

### Output Files

For each track, you produce:
- `trackname.mp3` — The audio
- `trackname.mid` — The tempo/beat map

---

## 10. Implementation Phases

### Phase 1: Core Playback (MVP)
- [ ] Project setup (Vite + React + TypeScript + Tailwind)
- [ ] ZIP upload + manifest parsing
- [ ] MIDI tempo track parser
- [ ] IndexedDB storage layer
- [ ] Basic grid UI with button states
- [ ] Single-track playback (no transitions)
- [ ] Duck control

### Phase 2: Transitions
- [ ] SoundTouchJS integration for time-stretching
- [ ] Beat scheduler (downbeat detection)
- [ ] Quantise ON mode (locked BPM transitions)
- [ ] Equal-power crossfade
- [ ] Transport status display

### Phase 3: Tempo Slide
- [ ] Quantise OFF mode (tempo slide algorithm)
- [ ] Dual-deck synchronised tempo ramping
- [ ] Polish transition smoothness

### Phase 4: PWA & Polish
- [ ] Service worker + offline caching
- [ ] Install prompt / Add to Home Screen
- [ ] Touch optimisation + large hit targets
- [ ] Tablet layout testing
- [ ] Error handling + validation feedback

---

## 11. Explicit Non-Goals (v1)

- Automatic beat detection (beat maps are pre-authored)
- Harmonic/key matching
- Waveform display or scrubbing
- More than two active decks
- Expert DJ controls (EQ, loops, cue points)
- Backend / cloud storage

---

## 12. Future Enhancements (v2+)

- **Multi-track queue list** — visible "Up Next" panel with per-transition settings
- **Queue editing** — reorder, delete, modify settings per queued item
- **Alternative stretch engine** — Rubberband WASM for higher quality (desktop only)

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **SoundTouchJS CPU usage on old tablets** | Test early; fall back to lower quality stretch if needed |
| **MIDI parsing edge cases** | Strict validation on upload; clear error messages |
| **Large ZIP files slow to process** | Show progress bar; process in web worker |
| **IndexedDB storage limits** | Check quota; warn user if approaching limit |
| **Audio context restrictions (autoplay)** | Require user tap before first playback |

---

## 14. Summary

This is a **beat-aware music switcher** — not a DAW or DJ deck.

It prioritises:
- **Confidence** — safe defaults, no surprises
- **Predictability** — deterministic transitions
- **Musical correctness** — beat-aligned, pitch-preserved
- **Minimal cognitive load** — press buttons, it sounds right

The user presses buttons.
The system makes it sound right.
