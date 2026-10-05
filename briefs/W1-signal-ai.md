# W1: make the watch FUNCTION: a real on-device motion classifier and a real data flow. Read /home/nico/pf/MOTION-BIBLE.md for house rules.

Today every "detection" is a canned event button. The case says the watch recognizes handwashing from motion and WILL be
wrong. Build the actual recognition on simulated accelerometer data so its mistakes are real, visible and explainable.

## A. Signal + classifier (pure JS, no network, no model files)
- `js/signal.js`: deterministic seeded generator of 50 Hz 3-axis accelerometer streams for scenarios: `wash` (20-25 s,
  rhythmic 3-5 Hz scrubbing, amplitude envelope, pauses to rinse), `gel` (6-9 s rub, 4-6 Hz), `door` (single spikes),
  `typing` (irregular small bursts), `wave` (one low-frequency swing), `idle`. A `noise` parameter 0..1 adds sensor
  noise and drops of signal, so wrongness emerges instead of being scripted.
- `js/classifier.js`: pure function over 1 s windows: features = RMS energy, dominant frequency in the 2-7 Hz band
  (small DFT), rhythmicity (autocorrelation peak), sustained-activity duration. Output per stream:
  `{label:'wash'|'gel'|'other', confidence:0..1, seconds, features}`. Decision: confidence >= 0.75 -> confident (`ok`
  haptic, ring +1); 0.4-0.75 -> uncertain (`doubtful` haptic, "Did you wash?" screen); < 0.4 or no event within
  the moment window -> nothing (reminder if a patient-zone moment is pending). Thresholds are named constants.
- Free-mode buttons and the guided story now run scenarios THROUGH the classifier; the doubtful moment in the story
  arises from `gel` at noise 0.55 with a fixed seed (still deterministic).

## B. Make the AI legible (not a black box)
- Stage "Motion signal" scope: live canvas waveform of the stream, the current 1 s window highlighted, a confidence
  meter, and one mono line "why": e.g. `rhythm 0.52 · 11 of 20 s · 4.1 Hz -> unsure`. A "Sensor noise" slider 0..1
  re-runs the last scenario so you can watch wrong marks appear. Colors from tokens only.

## C. Real data flow
- Event log schema `{id, ts, moment, outcome:'done'|'confirmed'|'declined'|'unsure'|'silenced', corrected:boolean}`: NO
  person field, structurally. Persist in Electron `userData/log.json` via preload IPC (browser fallback: localStorage).
  Per-event detail purged after 24 h (enforced on load and hourly). "Who sees this" row 'You' reads from this log.
- `unit.html` aggregates the real log plus a seeded 14-day demo history so it is never empty; the "staff corrections"
  number comes from `corrected:true` events. The unit page must have no way to filter by person (assert absence).
- Update `main.js`/preload accordingly; keep the app working in a plain browser.

## Acceptance (never delete or weaken an assertion)
1. `tests/classifier.test.js` (node, no browser): seeded `wash` at noise 0 -> wash, conf >= 0.85; `gel` -> gel
   conf >= 0.75; `door`, `typing`, `wave` -> other; `wash` at noise 0.8 yields uncertain or none in >= 30% of 50 seeds
   and never 'gel'; determinism: same seed same output; thresholds are the named constants.
2. Guided story still reaches the end; the doubtful beat is produced by the classifier (assert the features line).
3. Log: schema has no person field; 25 h old event details are purged; delete works; unit.html reflects a corrected event.
4. Noise slider changes the uncertain rate (assert on a fixed set of seeds).
Commit "watch: signal classifier and data flow". Report <= 8 lines, each claim with the test that proves it.
