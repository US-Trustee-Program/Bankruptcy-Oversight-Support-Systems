#!/usr/bin/env bash

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

acr_server=$1

export CAMS_PA11Y=true
npm run build
npm install serve -g
serve -s build &
timeout 120s sh -c 'until nc -z localhost 3000; do sleep 1; done'
if (( $? != 0 )); then
    echo "Webapp check timed out"
    exit 1
fi

echo "Starting axe accessibility test"
docker run "${acr_server}"/axe http://localhost:3000 --tags section508,wcag22aa,best-practice --exit
