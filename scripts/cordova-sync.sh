#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/cordova-app"

if [[ ! -f "${APP_DIR}/config.xml" ]]; then
  echo "Cordova wrapper not found. Run: npm run cordova:init"
  exit 1
fi

cd "${ROOT_DIR}"
npm run build
rsync -a --delete "${ROOT_DIR}/dist/" "${APP_DIR}/www/"

echo "Synced web build into ${APP_DIR}/www"
