#!/bin/bash
# Start local infrastructure for case-trustee-appointments integration tests.
# Runs MongoDB in a Podman pod with localhost networking.
#
# Usage:
#   ./start-services.sh
#   ./stop-services.sh
#
# After this script exits cleanly MongoDB is accepting connections:
#   MongoDB → localhost:27017

set -e

POD_NAME="cams-trustee-appt-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-trustee-appt-mongodb 2>/dev/null || true

echo "Creating pod ${POD_NAME}..."
podman pod create \
  --name "${POD_NAME}" \
  --publish 27017:27017

echo "Starting MongoDB..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-trustee-appt-mongodb \
  mongo:7.0 --bind_ip_all

echo "Waiting for MongoDB..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/27017' 2>/dev/null; then
    echo "  MongoDB ready"
    break
  fi
  [ "$i" -eq 30 ] && echo "ERROR: MongoDB failed to start" && exit 1
  sleep 1
done

echo ""
echo "Services ready."
echo "  MongoDB → localhost:27017"
echo ""
echo "Copy .env.local.template to .env.local and set COSMOS_DATABASE_NAME."
echo "Run stop-services.sh to tear down."
