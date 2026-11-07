#!/usr/bin/env bash
# Start the Wear OS emulator, install the watch app, and open a clean mirror.
# The emulator's own window crops the watch under Wayland, so scrcpy shows it
# instead (mouse wheel = crown, click = tap, Enter = confirm).
set -euo pipefail
cd "$(dirname "$0")/.."
SDK="$HOME/Android/sdk"
SERIAL=emulator-5554

if ! adb -s "$SERIAL" get-state >/dev/null 2>&1; then
  rm -f "$HOME/.android/avd/hhw_watch.avd/"*.lock
  # Flags matter: -no-window, -gpu swiftshader and Qt scaling vars all
  # crash this emulator build on this machine (RenderThread SIGSEGV).
  nohup "$SDK/emulator/emulator" -avd hhw_watch -no-snapshot-save -no-boot-anim \
    >/dev/null 2>&1 &
  echo "Booting the watch..."
  until [ "$(adb -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do
    sleep 3
  done
fi

[ -f wear/out/hand-hygiene-wear.apk ] || wear/build.sh
adb -s "$SERIAL" install -r wear/out/hand-hygiene-wear.apk >/dev/null
echo "Watch ready."
exec scrcpy -s "$SERIAL" --window-title "Hand Hygiene Watch" \
  --window-width 454 --window-height 454 --no-audio --stay-awake
