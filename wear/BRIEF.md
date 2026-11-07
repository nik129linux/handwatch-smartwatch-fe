# BRIEF: Hand Hygiene, Wear OS watch app (no Gradle)

Goal: a tiny Wear OS app that shows one hand-hygiene alert, vibrates its pattern, and lets
the nurse answer with the crown (rotate to move, press to confirm) or a tap.
Work ONLY inside this `wear/` folder. Do not touch anything outside it. Do not commit.
Do not run adb or an emulator (a human verifies).

## App
- Package `co.ucc.handhygiene.wear`, label `Hand Hygiene`, minSdk 30, targetSdk 34.
  Manifest: `<uses-feature android:name="android.hardware.type.watch" />`,
  `android.permission.VIBRATE`, theme `@android:style/Theme.DeviceDefault`.
  No AndroidX, no libraries, framework APIs only.
- `AlertActivity` (exported, also the launcher). Started by adb with string extras
  `title`, `body`, `kind` (`reminder` | `doubtful` | `ok` | `end`). Launched with no extras:
  show "Hand Hygiene" / "Waiting for the shift".
  - Pure black background (OLED). Title 20sp white, body 15sp grey (#9a9a9a), centered,
    inside a round-safe padding (~12% of width on each side).
  - On every new intent (`onNewIntent` too, `launchMode="singleTop"`): vibrate the kind's
    pattern with `Vibrator.createWaveform(timings, -1)`. Patterns in ms, ON/OFF alternating,
    starting with ON (prepend a 0 delay): reminder [60,120,60], ok [35], doubtful
    [30,70,45,70,65], end [400]. No sound, ever.
  - `kind=doubtful`: two full-width pill buttons stacked vertically:
    "Yes, I did" (fill #a6ff00, text #101010) and "Couldn't" (fill #333333, text white),
    min height 52dp, radius 26dp. `kind=reminder`: one pill "Already did it".
    Other kinds: no buttons, the screen closes itself after 4 s.
  - Selection: exactly one button is "selected" (2dp white outline). Rotary input
    (`onGenericMotionEvent`, source `InputDevice.SOURCE_ROTARY_ENCODER`, axis
    `MotionEvent.AXIS_SCROLL`) moves the selection down/up, one step per detent sign change
    or per |delta| ≥ 0.5 accumulated. Confirm = press of `KEYCODE_STEM_PRIMARY`,
    `KEYCODE_DPAD_CENTER` or `KEYCODE_ENTER` (override `onKeyDown`), or a tap on a button.
    Arrow keys `KEYCODE_DPAD_DOWN/UP` also move the selection (makes emulator testing easy).
  - On confirm: `Log.i("HHW", "answer=yes")` for "Yes, I did" and "Already did it",
    `Log.i("HHW", "answer=no")` for "Couldn't"; vibrate the `ok` pattern; show
    "Noted. Thanks." (yes) or "Stays with you." (no) for 1.5 s; then `finish()`.
- Small launcher icon: a vector drawable (simple drop glyph, lime #a6ff00 on #101010).
- English everywhere.

## Build
Copy `build.sh.reference` to `build.sh` and adapt it: platform `android-34` (fall back to
`android-35` if 34 is not installed), `--min-api 30`, output `out/hand-hygiene-wear.apk`,
own `debug.keystore` in this folder. `.gitignore`: `out/ gen/ obj/`.
Delete `build.sh.reference` when done.

## Acceptance (binary; run them, paste outputs in your final message)
1. `rm -rf out gen obj && ./build.sh` exits 0 and produces `out/hand-hygiene-wear.apk`.
2. `$HOME/Android/sdk/build-tools/35.0.0/apksigner verify out/hand-hygiene-wear.apk` exits 0.
3. `$HOME/Android/sdk/build-tools/35.0.0/aapt2 dump badging out/hand-hygiene-wear.apk`
   shows package `co.ucc.handhygiene.wear`, a launchable activity, and the
   `android.hardware.type.watch` feature.
4. `grep -n "answer=yes\|answer=no\|SOURCE_ROTARY_ENCODER\|KEYCODE_STEM_PRIMARY\|createWaveform" -r src`
   shows all five.
5. `README.md` with build, install (`adb -s emulator-5554 install -r out/hand-hygiene-wear.apk`)
   and the trigger:
   `adb -s emulator-5554 shell am start -n co.ucc.handhygiene.wear/.AlertActivity --es title "Did you wash?" --es body "Not sure - Bed 3" --es kind doubtful`
