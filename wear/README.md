# Hand Hygiene (Wear OS)

Build:

```
rm -rf out gen obj && ./build.sh
```

Install:

```
adb -s emulator-5554 install -r out/hand-hygiene-wear.apk
```

Trigger:

```
adb -s emulator-5554 shell am start -n co.ucc.handhygiene.wear/.AlertActivity --es title "Did you wash?" --es body "Not sure - Bed 3" --es kind doubtful
```