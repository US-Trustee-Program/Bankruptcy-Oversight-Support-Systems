#!/bin/bash
# Start local infrastructure for the sync-acms-professional-ids-audit backtest scripts
# (pipeline-replay-backtest.ts). Runs a disposable MongoDB in its own Podman pod, on its own
# port, distinct from the shared cams-local-infra-mongo container other agents/tooling depend
# on and from trustee-match-normalization's own disposable Mongo (port 27018).
#
# Usage:
#   ./start-services.sh
#   ./stop-services.sh
#
# After this script exits cleanly MongoDB is accepting connections:
#   MongoDB → localhost:27118

set -e

POD_NAME="cams-876-replay-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-876-replay-mongodb 2>/dev/null || true

echo "Creating pod ${POD_NAME}..."
podman pod create \
  --name "${POD_NAME}" \
  --publish 127.0.0.1:27118:27017

echo "Starting MongoDB..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-876-replay-mongodb \
  mongo:7.0 --bind_ip_all

echo "Waiting for MongoDB..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/27118' 2>/dev/null; then
    echo "  MongoDB ready"
    break
  fi
  [ "$i" -eq 30 ] && echo "ERROR: MongoDB failed to start" && exit 1
  sleep 1
done

echo ""
echo "Services ready."
echo "  MongoDB → localhost:27118"
echo ""
echo "Copy .env.template to .env.local (already pointed at port 27118)."
echo "Run stop-services.sh to tear down."
