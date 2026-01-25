# Test Criteria for Marcação Mestre

Last updated: 2026-01-25 (v0.1.9)

---

## P0-Quick: Default Settings & Mix Options

### TC-001: Default Quantise OFF
- **Steps:** Load app fresh (clear localStorage if needed)
- **Expected:** Quantise toggle is OFF by default
- **Status:** [ ]

### TC-002: Default Mix Length 2 Bars
- **Steps:** Load app fresh
- **Expected:** Mix length selector shows "2" bars selected
- **Status:** [ ]

### TC-003: Mix Length Options Available
- **Steps:** Open mix length selector
- **Expected:** Options 0, 1, 2, 4, 8 bars are available
- **Status:** [ ]

### TC-004: Hard Cut (0 Bars)
- **Steps:** Set mix length to 0, play track, queue another track
- **Expected:** Immediate switch with no crossfade when transition triggers
- **Status:** [ ]

### TC-005: Crossfade (1+ Bars)
- **Steps:** Set mix length to 2, play track, queue another track
- **Expected:** Audible crossfade over approximately 2 bars duration
- **Status:** [ ]

---

## P0-Core: Multi-Track Queue System

### TC-010: Single Click - Add to End of Queue
- **Steps:** While a track is playing, single-click another track (wait 300ms)
- **Expected:** Track is added to end of queue, console logs "Track added to queue (end)"
- **Status:** [ ]

### TC-011: Double Click - Insert as Next
- **Steps:** While a track is playing, double-click another track quickly
- **Expected:** Track is inserted at front of queue, console logs "Track added to queue (next)"
- **Status:** [ ]

### TC-012: Triple Click - Immediate Mix
- **Steps:** Triple-click a track quickly
- **Expected:** Track immediately starts mixing/playing (bypasses queue)
- **Status:** [ ]

### TC-013: Single Click When Idle - Play Immediately
- **Steps:** With nothing playing, single-click a track
- **Expected:** Track starts playing immediately (not queued)
- **Status:** [ ]

### TC-014: Queue Advances Automatically
- **Steps:** Queue multiple tracks, let mix complete
- **Expected:** After mix completes, next track in queue auto-prepares
- **Status:** [ ]

### TC-015: Stop Clears Queue
- **Steps:** Queue tracks, press Stop
- **Expected:** Playback stops, queue is cleared
- **Status:** [ ]

---

## Transport State Display

### TC-020: Version Badge Visible
- **Steps:** Load app
- **Expected:** Version badge shows in bottom-right corner (e.g., "v0.1.8")
- **Status:** [ ]

### TC-021: Current Track Highlighted
- **Steps:** Play a track
- **Expected:** Playing track button shows green/playing state
- **Status:** [ ]

### TC-022: Queued Track Highlighted
- **Steps:** Queue a track while playing
- **Expected:** Queued track shows amber/pulse animation
- **Status:** [ ]

### TC-023: BPM Display Updates
- **Steps:** Play tracks with different native BPMs
- **Expected:** BPM display reflects current playback tempo
- **Status:** [ ]

---

## P0-Controls: Pause & Import

### TC-030: Pause Button Disables When Idle
- **Steps:** Load app with no track playing
- **Expected:** Pause button is grayed out and disabled
- **Status:** [ ]

### TC-031: Pause Stops Audio
- **Steps:** Play a track, click Pause
- **Expected:** Audio stops, button changes to "PLAY", status shows "PAUSED"
- **Status:** [ ]

### TC-032: Resume From Pause
- **Steps:** While paused, click Play
- **Expected:** Audio resumes from where it paused
- **Status:** [ ]

### TC-033: Drag-and-Drop Upload
- **Steps:** Drag a .zip file onto the upload area
- **Expected:** Drop zone highlights blue, file loads on drop
- **Status:** [ ]

### TC-034: Click-to-Upload Still Works
- **Steps:** Click the upload area, select .zip file
- **Expected:** File dialog opens, library loads after selection
- **Status:** [ ]

### TC-035: Reject Non-ZIP Files
- **Steps:** Drag a non-.zip file onto upload area
- **Expected:** Error message "Please upload a .zip file"
- **Status:** [ ]

---

## Notes

- [ ] = Not tested
- [x] = Passed
- [!] = Failed (add notes)

To test: Run `./rebuild.sh` then open http://localhost:5173/Marcacao-Mestre/