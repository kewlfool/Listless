#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/cordova-app"

if [[ ! -d "${APP_DIR}" ]]; then
  npx cordova create "${APP_DIR}" com.deviousdesign.listless.iosdev Listless
fi

cd "${APP_DIR}"

platforms_output="$(npx cordova platform ls)"
if ! grep -q 'ios ' <<< "${platforms_output}"; then
  npx cordova platform add ios
fi

plugins_output="$(npx cordova plugin ls)"
if ! grep -q 'cordova-plugin-local-notification ' <<< "${plugins_output}"; then
  npx cordova plugin add cordova-plugin-local-notification
fi

echo "Cordova iOS wrapper is ready at ${APP_DIR}"
