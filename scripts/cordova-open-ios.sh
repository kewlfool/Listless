#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_WORKSPACE="${ROOT_DIR}/cordova-app/platforms/ios/App.xcworkspace"

if [[ ! -d "${IOS_WORKSPACE}" ]]; then
  echo "iOS workspace not found. Run: npm run cordova:prepare:ios"
  exit 1
fi

open "${IOS_WORKSPACE}"
