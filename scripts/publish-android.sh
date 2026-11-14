#!/bin/bash
# Build the signed Android app and put it where people can download it:
#   https://sinsera.co/gossoko/android/   (page)   +   /gossoko/android/Gossoko.apk
# Run from the repo root AFTER `npm run build`; then `python3 scripts/deploy.py` uploads it with the site.
# The APK is never committed (dist/ is build output).
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export SINSERA_ANDROID_KEYSTORE_PASS="${SINSERA_ANDROID_KEYSTORE_PASS:-$(security find-generic-password -s sinsera-android-keystore -w)}"
(cd native && npx cap sync android >/dev/null)
(cd native/android && ./gradlew assembleRelease -q)
[ -f dist/index.html ] || { echo "dist/ missing — run npm run build first" >&2; exit 1; }
mkdir -p dist/android
cp native/android/app/build/outputs/apk/release/app-release.apk dist/android/Gossoko.apk
echo "OK — dist/android/Gossoko.apk ($(du -h dist/android/Gossoko.apk | cut -f1)). Now: python3 scripts/deploy.py"
