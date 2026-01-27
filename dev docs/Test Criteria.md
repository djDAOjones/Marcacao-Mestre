# Test Criteria for Marcação Mestre

Last updated: 2026-01-27 (v0.1.13)

---

## P0-Quick: Transition Modes (v4)

### TC-001: Default Mode is MIX

- **Steps:** Load app fresh (clear localStorage if needed)
- **Expected:** MIX button is highlighted (blue), CUT is not
- **Status:** [ ]

### TC-002: MIX Mode Crossfade

- **Steps:** Set MIX mode, play track, queue another, trigger transition
- **Expected:** 2-bar crossfade with tempo slide to incoming BPM
- **Status:** [ ]

### TC-003: CUT Mode Bar-Aligned Switch

- **Steps:** Set CUT mode, play track, queue another, press NEXT
- **Expected:** Cut occurs at next bar downbeat, beats aligned, tempo matched
- **Status:** [ ]

### TC-004: NEXT Button Triggers Transition

- **Steps:** Queue a track, press NEXT button
- **Expected:** Transition starts immediately (waits for bar in CUT mode)
- **Status:** [ ]

### TC-005: NEXT Button Disabled When No Queue

- **Steps:** Play a track with nothing queued
- **Expected:** NEXT button is grayed out and disabled
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
- **Expected:** Version badge shows in bottom-right corner (e.g., "v0.1.13")
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

### TC-031: Pause With Fade

- **Steps:** Play a track, click Pause
- **Expected:** Audio fades out over 0.5s, button changes to "PLAY", status shows "PAUSED"
- **Status:** [ ]

### TC-032: Resume With Rewind and Fade

- **Steps:** While paused, click Play
- **Expected:** Audio rewinds 1s and fades in over 0.5s
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

## Duck Feature

### TC-036: Duck Toggle

- **Steps:** Press DUCK button while playing
- **Expected:** Button highlights yellow, audio fades to -15dB over 1s
- **Status:** [ ]

### TC-037: Duck Ramp Time

- **Steps:** Toggle duck on and off while playing
- **Expected:** Volume change is gradual (~1 second), not instant
- **Status:** [ ]

### TC-038: Duck EQ Cut

- **Steps:** Toggle duck on while playing vocal/mid-heavy track
- **Expected:** Mid frequencies (4kHz) sound noticeably reduced
- **Status:** [ ]

### TC-039: Duck Off Restores Full Audio

- **Steps:** Turn duck off after it was on
- **Expected:** Volume and EQ return to normal over ~1 second
- **Status:** [ ]

---

## Fix Tempo Feature

### TC-043: CUT Mode Native Speed

- **Steps:** Set mode to CUT, queue and trigger a track transition
- **Expected:** Incoming track plays at its native BPM (no time-stretching)
- **Status:** [ ]

### TC-044: Fix Tempo Toggle ON

- **Steps:** Press FIX button while playing
- **Expected:** Button turns green, current track time-stretches to target BPM
- **Status:** [ ]

### TC-045: Fix Tempo Toggle OFF

- **Steps:** Turn Fix Tempo off while playing
- **Expected:** Current track reverts to native speed, BPM display updates
- **Status:** [ ]

### TC-046: Fix Tempo with CUT Mode

- **Steps:** Enable Fix Tempo, then trigger CUT transition
- **Expected:** Incoming track plays at target BPM (tempo-matched)
- **Status:** [ ]

### TC-047: Interactive BPM Click-to-Edit

- **Steps:** Click on BPM display
- **Expected:** Text input appears, can type new BPM value (60-200)
- **Status:** [ ]

### TC-048: Interactive BPM Drag Adjust

- **Steps:** Click and drag up/down on BPM display
- **Expected:** BPM value changes in real-time, Fix Tempo enables automatically
- **Status:** [ ]

### TC-049: BPM Edit Submits on Enter

- **Steps:** Click BPM, type new value, press Enter
- **Expected:** New BPM applied, Fix Tempo enabled, input closes
- **Status:** [ ]

### TC-050: BPM Edit Cancels on Escape

- **Steps:** Click BPM, type value, press Escape
- **Expected:** Edit cancelled, original BPM retained
- **Status:** [ ]

---

## UI Sizing

### TC-040: Track Pads Compact Size

- **Steps:** Load library with multiple tracks
- **Expected:** Track pads are compact (~60px), more tracks visible on screen
- **Status:** [ ]

### TC-041: Control Buttons Large Size

- **Steps:** View control bar
- **Expected:** MIX/CUT, NEXT, PAUSE, STOP buttons are large (56px+ height)
- **Status:** [ ]

### TC-042: Controls Easily Tappable on Tablet

- **Steps:** Use app on tablet or touch device
- **Expected:** All control buttons easily tappable without mis-taps
- **Status:** [ ]

---

## Notes

- [ ] = Not tested
- [x] = Passed
- [!] = Failed (add notes)

To test: Run `./rebuild.sh` then open http://localhost:5173/Marcacao-Mestre/