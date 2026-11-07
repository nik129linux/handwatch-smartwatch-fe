# Hand Hygiene Watch

Hospital hand-hygiene smartwatch prototype + infection-control unit view.
The watch reminds and records in silence, on the body. The watch WILL be
wrong — a wrong mark is corrected with one tap and never shown as an
accusation. See `DEMO.md` for the 2-minute script.

## Run

- Desktop app: `npm start` (or the **Hand Hygiene Watch** launcher).
- Browser fallback: open `index.html`; unit view is `unit.html`.
- Works offline; **EN | ES** switch on both pages (Spanish is neutral Colombian,
  every string in `js/strings-es.js`); sun/moon toggle. Both choices persist.

## Real watch (the "8 Ultra" clone)

The test watch runs closed firmware: no custom apps, but it mirrors phone
notifications and buzzes. Panel → **Real watch → Send to my wrist** sends
each haptic as a short alert (title ≤ 4 words, bed/moment/totals only, no
names). With the phone on adb (USB or Wi-Fi debugging) the desktop app
broadcasts to the **Hand Hygiene** relay app (`android/`, offline), which
WearPro mirrors to the watch; without a phone it falls back to an ntfy.sh
topic. One-time setup: install the relay, allow it in WearPro's message
notifications, and on Honor set it to "Manage manually" in App launch.
Answering: the clone drops notification buttons, so the doubt alert's
**Yes, I did / Couldn't** buttons work from the phone's shade (and the
watch's music Play/Next, if its firmware forwards them); the relay logs
`answer=yes|no`, the desktop app tails it over adb and closes the open
question on the simulated watch exactly like a tap. The clone has one vibration of its own, so the
four-pattern vocabulary lives on the simulator; answers are tapped there.
`js/wrist.js` · `tests/wrist.test.js`.

## Wear OS emulator (a real watch OS on the PC)

`npm run watch` boots a Wear OS 5 emulator (AVD `hhw_watch`) as a floating
454×454 window and installs `wear/`. On Hyprland the emulator auto-zooms
and crops the watch; the script pins `window.scale = 1` (the emulator resets
it on exit) and floats the window. Use the side toolbar's ⋯ for the crown
and buttons; `scrcpy -s emulator-5554` is a fallback mirror where the mouse
wheel is the crown and Enter confirms.
With **Send to my wrist** on, every haptic opens the alert on the emulated
watch with its real vibration pattern. Answer by turning the crown to pick
*Yes, I did* / *Couldn't* and pressing the second button (or tap; arrow keys
+ Enter also work). The crown press itself is Home on Wear OS and never
reaches apps. Phone relay and emulator can run at the same time.

## Controls

Crown wheel scrolls, crown click = Home, side button = privacy,
Esc = back. Panel: **▶ Guided shift** (~75 s story), free-mode event
buttons, sensor-noise slider, haptic vocabulary, event log.

## Layout

`index.html` stage (watch + panel) · `unit.html` unit view ·
`css/tokens.css` only raw colors · `css/watch.css` `css/stage.css` ·
`js/watch.js` router · `js/story.js` story + free-mode bus ·
`js/signal.js` `js/classifier.js` sensor synthesis + verdict ·
`js/sense.js` wiring · `js/scope.js` waveform · `js/log.js` 24 h store ·
`js/haptics.js` vibration vocabulary · `main.js` Electron shell.

## AI (system fixes, never accusations)

- **Trained gesture model** (`js/model.js`, weights in `js/model-weights.js`,
  `node scripts/train-model.js` reproduces them byte for byte): softmax
  regression over 7 motion features (rhythm, tone, active seconds…), trained
  on 1,800 streams (seeds 100000+), tested on seeds it never saw.
  Held-out at noise 0.35: **99%** vs **98%** for the old hand-written rules,
  which stay in `classifier.js` as the baseline. Honest limit: the streams
  come from the simulator (`js/signal.js`), not a ward; real wrist
  recordings are the next step.
- **Ask the unit** (`unit.html` → `js/ask.js`): infection control asks in
  plain words (EN or ES) or taps one of 5 suggestions. Answers come only
  from the anonymous totals. A question about a person ("which nurse…",
  a proper name) is refused on the page and nothing leaves. Offline/browser:
  rules answer. In the desktop app, after consent (the exact question +
  totals are shown first), gemma answers through Ollama; an answer with a
  number not in the facts, blame wording or a leaked data key is dropped
  and the rules answer instead. Measured: 10/10 gemma answers kept,
  ~0.5 s each. The badge says which one answered.
- Note: `gemma4:31b-cloud` runs on ollama.com, so the payload leaves the PC
  (aggregates only, after consent). `OLLAMA_MODEL=<local model>` keeps it local.
- On-device calibration (`js/calibrate.js`): each "Yes, I did" lifts the
  decision threshold a bounded step for that moment + noise bucket, so
  repeat false marks fade while real misses still flag. Home shows
  "Learning · fewer marks".
- Unit pattern finder + **Why** button on each log row: same rules-first,
  grounded chain.

## Rules (graded)

No sound ever · never red, no accusation wording on the watch ·
unit view has no per-person view · haptics `[60,120,60]` `[35]`
`[30,70,45,70,65]` `[400]` · contrast ≥ 4.5:1 both themes.

## Tests

`node tests/acceptance.js` (browser gate, 240 checks) ·
`node tests/i18n.test.js` (Spanish build: no English left, watch lines <= 4 words) ·
`node tests/ask.test.js` (Ask the unit: routing, person guard, grounding) ·
`node tests/model.test.js` (trained model, honest split, reproducible) ·
`node tests/fold.test.js` (no pill cut by the screen edge) ·
`node tests/w1.test.js` · `classifier` · `calibrate` · `eval` · `stats` ·
`timeseries` · `ai` · `wrist` (`node tests/<name>.test.js`) ·
`node tests/electron-smoke.js` (desktop app; prefix `xvfb-run -a` on Wayland).
