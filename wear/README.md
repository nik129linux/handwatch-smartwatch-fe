# Hand Hygiene (Wear OS)

A standalone Wear OS companion for the desktop prototype. Spanish is the
default language regardless of the device locale; English only when the
desktop sends `lang=en` or the wearer picks English in Ajustes.

## Build

From this folder:

```
rm -rf out gen obj && ./build.sh
```

The script uses aapt2/d8/apksigner from `~/Android/sdk/build-tools/35.0.0`
and the system `javac --release 11`. No Gradle, no AndroidX.

## Install

```
adb -s emulator-5554 install -r out/hand-hygiene-wear.apk
```

## Screens

The app follows the desktop flow: a 15-moment Home ring, the first-run
guide (three cards, once), Ajustes (language, replay the guide, Ayuda,
Borrar mis datos) and Ayuda (the four vibrations with a play button).

Open each screen directly:

```
# Home (the launcher: no kind opens Home)
adb -s emulator-5554 shell am start -n co.ucc.handhygiene.wear/.HomeActivity

# First-run guide (three cards; replayable from Ajustes)
adb -s emulator-5554 shell am start -n co.ucc.handhygiene.wear/.GuideActivity

# Ajustes
adb -s emulator-5554 shell am start -n co.ucc.handhygiene.wear/.SettingsActivity

# Ayuda (the four vibrations)
adb -s emulator-5554 shell am start -n co.ucc.handhygiene.wear/.HelpActivity

# Doubtful alert: "¿Te lavaste?" with "Sí, me lavé" / "No alcancé"
adb -s emulator-5554 shell am start -n co.ucc.handhygiene.wear/.AlertActivity \
  --es kind doubtful

# Same alert in English
adb -s emulator-5554 shell am start -n co.ucc.handhygiene.wear/.AlertActivity \
  --es kind doubtful --es lang en
```

The launcher activity is `AlertActivity`: no `kind` extra sends it to Home,
so tapping the app icon behaves like the Home command above.

## Desktop bridge extras

`AlertActivity` accepts `kind` (`reminder` | `doubtful` | `ok` | `end`),
`title`, `body`, `lang` (`es` | `en`), `done` and `plan`. `done`/`plan`
update the ring; `done` is clamped to `plan`, so the ring never reads
`16 / 15`.

## Tests

`npm test` at the repository root includes `tests/wear.test.js`: it builds
the APK, checks both locales with `aapt2 dump resources`, greps the Java
for hardcoded UI strings and asserts no button is smaller than 48dp.
