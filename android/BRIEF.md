# BRIEF: Hand Hygiene relay app (Android, no Gradle)

Goal: a tiny Android app that turns an adb broadcast into a phone notification, so the
watch companion app (WearPro) mirrors it to a cheap smartwatch. Work ONLY inside this
`android/` folder. Do not touch anything outside it.

## App
- Package `co.ucc.handhygiene`, label `Hand Hygiene`, minSdk 26, targetSdk 35.
- `MainActivity` (launcher, so WearPro lists the app): one screen, plain TextView:
  "Hand Hygiene relay is ready. Keep this app allowed in WearPro." On create, request
  `POST_NOTIFICATIONS` on API 33+. No other UI, no AndroidX, no libraries.
- `NotifyReceiver` (exported, `android:exported="true"`), action
  `co.ucc.handhygiene.NOTIFY`, string extras `title`, `body`, `kind`.
  It posts one notification on channel id `wrist` (name "Wrist", IMPORTANCE_HIGH,
  vibration on, NO sound: `setSound(null, null)`), small icon = a vector drawable you
  draw (simple hand/drop glyph, white), category MESSAGE, auto-cancel.
  Each broadcast uses a new notification id (so the watch buzzes every time).
  `title` capped at 40 chars, `body` at 80; missing title → ignore the broadcast.
- English everywhere (code, comments, strings).

## Build: `./build.sh` (bash, set -euo pipefail)
SDK at `$HOME/Android/sdk`, build-tools `35.0.0`, platform `android-35`, JDK 25 on PATH.
Pipeline: aapt2 compile + link (with `-I android.jar`, `--manifest`, `--java gen`) →
javac (`--release 11`, classpath android.jar) → d8 (`--min-api 26`) → add classes.dex to
the apk → zipalign → apksigner with a debug keystore created once in `android/debug.keystore`
(keytool, password `android`). Output: `android/out/hand-hygiene.apk`.
Add `android/out/`, `android/gen/`, `android/obj/` to a local `android/.gitignore`.

## Acceptance (binary; run them and paste the output in your final message)
1. `./build.sh` exits 0 from a clean tree (`rm -rf out gen obj` first) and produces the apk.
2. `$HOME/Android/sdk/build-tools/35.0.0/apksigner verify out/hand-hygiene.apk` exits 0.
3. `$HOME/Android/sdk/build-tools/35.0.0/aapt2 dump badging out/hand-hygiene.apk` shows
   package `co.ucc.handhygiene`, label `Hand Hygiene`, a launchable activity.
4. `README.md` in this folder: build, install (`adb install -r out/hand-hygiene.apk`), and
   the exact trigger command:
   `adb shell am broadcast -n co.ucc.handhygiene/.NotifyReceiver -a co.ucc.handhygiene.NOTIFY --es title "Did you wash?" --es body "Bed 3" --es kind doubtful`

Do NOT run adb or install on any device (a human verifies on the phone). Do not commit.
