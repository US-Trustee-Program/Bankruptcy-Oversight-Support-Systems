#!/usr/bin/env bash

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

export CAMS_PA11Y=true
npm run build
npm install serve -g
serve -s build &
if ! timeout 120s sh -c 'until nc -z localhost 3000; do sleep 1; done'; then
    echo "Webapp check timed out"
    exit 1
fi

echo "Starting pa11y accessibility test"
pa11y-ci -j | tee accessibility-output.json
ERRORS=$(jq .errors < accessibility-output.json)
if [ "${ERRORS}" -eq 0 ]; then
  echo "pa11y found no errors."
else
  echo "pa11y found ${ERRORS} errors."
  exit 1
fi
