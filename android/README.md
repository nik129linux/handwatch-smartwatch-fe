# Hand Hygiene relay

Tiny Android app that turns an adb broadcast into a phone notification so the
WearPro companion app mirrors it to a paired smartwatch.

## Build

```sh
./build.sh
```

Output: `out/hand-hygiene.apk`.

## Install

```sh
adb install -r out/hand-hygiene.apk
```

## Trigger notification

```sh
adb shell am broadcast -n co.ucc.handhygiene/.NotifyReceiver -a co.ucc.handhygiene.NOTIFY --es title "Did you wash?" --es body "Bed 3" --es kind doubtful
```