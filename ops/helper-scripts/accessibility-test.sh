#!/usr/bin/env bash

set -euo pipefail

export REACT_APP_PA11Y=true
npm run build
npm install serve -g
serve -s build &
timeout 120s sh -c 'until nc -z localhost 3000; do sleep 1; done'
if (( $? != 0 )); then
    echo "Webapp check timed out"
    exit 1
fi

echo "Starting pa11y accessibility test"
ERRORS=$(pa11y-ci -j | jq .errors)
if [ $ERRORS -eq 0 ]; then
  echo "pa11y found no errors."
else
  echo "pa11y found ${ERRORS} errors."
  exit 1
fi
