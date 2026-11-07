#!/usr/bin/env bash
# Start the Wear OS emulator with the whole watch visible, install the watch app.
# Two fixes for Hyprland (found 2026-11-07):
#  - the emulator zooms itself (window.scale = -1 = auto) and crops the watch;
#    it rewrites that key on every exit, so it is pinned to 1 before each launch.
#  - Hyprland tiles the window and stretches it; it is floated at its own size.
# Flags matter: -no-window and -gpu swiftshader_indirect crash this build.
set -euo pipefail
cd "$(dirname "$0")/.."
SDK="$HOME/Android/sdk"
AVD="$HOME/.android/avd/hhw_watch.avd"
SERIAL=emulator-5554

if ! adb -s "$SERIAL" get-state >/dev/null 2>&1; then
  rm -f "$AVD/"*.lock
  if grep -q '^window.scale' "$AVD/emulator-user.ini" 2>/dev/null; then
    sed -i 's/^window.scale = .*/window.scale = 1.000000/' "$AVD/emulator-user.ini"
  else
    echo 'window.scale = 1.000000' >> "$AVD/emulator-user.ini"
  fi
  nohup "$SDK/emulator/emulator" -avd hhw_watch -no-snapshot-save -no-boot-anim \
    >/dev/null 2>&1 &
  echo "Booting the watch..."
  until [ "$(adb -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do
    sleep 3
  done
fi

# Float the emulator window (Hyprland only; harmless elsewhere).
if command -v hyprctl >/dev/null; then
  ADDR=$(hyprctl clients -j | python3 -c "import json,sys
for c in json.load(sys.stdin):
    if c['class']=='Emulator' and c['title'].startswith('Android Emulator'): print(c['address'])")
  [ -n "$ADDR" ] && hyprctl dispatch "hl.dsp.window.float({ action = 'enable', window = 'address:$ADDR' })" >/dev/null
fi

[ -f wear/out/hand-hygiene-wear.apk ] || wear/build.sh
adb -s "$SERIAL" install -r wear/out/hand-hygiene-wear.apk >/dev/null
echo "Watch ready. (Fallback mirror: scrcpy -s $SERIAL)"
