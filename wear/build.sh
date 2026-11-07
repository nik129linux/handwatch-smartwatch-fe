#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

SDK="${HOME}/Android/sdk"
if [ -d "${SDK}/platforms/android-34" ]; then
    PLATFORM_DIR="android-34"
else
    PLATFORM_DIR="android-35"
fi
BUILD_TOOLS="${SDK}/build-tools/35.0.0"
PLATFORM="${SDK}/platforms/${PLATFORM_DIR}"
ANDROID_JAR="${PLATFORM}/android.jar"

mkdir -p gen obj obj/classes out

# 1. Compile resources.
"${BUILD_TOOLS}/aapt2" compile --dir res -o obj/resources.zip

# 2. Link resources + manifest, generate R.java.
"${BUILD_TOOLS}/aapt2" link \
    -I "${ANDROID_JAR}" \
    --manifest AndroidManifest.xml \
    -o obj/hand-hygiene-unsigned.apk \
    --java gen \
    obj/resources.zip

# 3. Compile Java sources.
find src gen -type f -name "*.java" > obj/sources.txt
javac --release 11 -cp "${ANDROID_JAR}" -d obj/classes @obj/sources.txt

# 4. Convert to dex.
find obj/classes -type f -name "*.class" > obj/classes.txt
"${BUILD_TOOLS}/d8" --min-api 30 --output obj @obj/classes.txt

# 5. Add classes.dex to the apk.
(
    cd obj
    zip -u hand-hygiene-unsigned.apk classes.dex
)

# 6. Align.
"${BUILD_TOOLS}/zipalign" -f -p 4 obj/hand-hygiene-unsigned.apk obj/hand-hygiene-aligned.apk

# 7. Sign with a debug keystore created once.
KEYSTORE="debug.keystore"
if [ ! -f "${KEYSTORE}" ]; then
    keytool -genkeypair -v \
        -keystore "${KEYSTORE}" \
        -storepass android \
        -alias androiddebugkey \
        -keypass android \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=Android Debug,O=Android,C=US"
fi

"${BUILD_TOOLS}/apksigner" sign \
    --ks "${KEYSTORE}" \
    --ks-key-alias androiddebugkey \
    --ks-pass pass:android \
    --key-pass pass:android \
    --out out/hand-hygiene-wear.apk \
    obj/hand-hygiene-aligned.apk