#!/bin/bash
# Start local infrastructure for trustee-verification-remap integration tests.
# Runs MongoDB, Azurite, and the dataflows function app in a shared Podman pod
# (localhost networking). No SQL Edge: the trustee-verification-remap dataflow
# itself needs no DXTR/ACMS SQL access.
#
# Usage:
#   ./start-services.sh         # build image (if needed) and start all services
#   ./stop-services.sh          # tear down
#
# After this script exits cleanly all services are accepting connections:
#   MongoDB   → localhost:27017
#   Azurite   → localhost:10001 (queue endpoint)
#   Dataflows → localhost:7072

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"

if [ ! -f "${SCRIPT_DIR}/../local.settings.integration.json" ]; then
  echo "ERROR: ../local.settings.integration.json is not present." >&2
  echo "Copy local.settings.integration.json.template to local.settings.integration.json first." >&2
  exit 1
fi

POD_NAME="cams-trustee-verification-remap-pod"
IMAGE="localhost/integration_dataflows_trustee_verification_remap:latest"

echo "Building dataflows image..."
podman build -t "${IMAGE}" \
  -f "${SCRIPT_DIR}/../Dockerfile.dataflows" \
  "${REPO_ROOT}"

# Clean up any previous run
podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f \
  cams-mongodb-trustee-verification-remap \
  cams-azurite-trustee-verification-remap \
  cams-dataflows-trustee-verification-remap 2>/dev/null || true

echo "Creating pod ${POD_NAME}..."
podman pod create \
  --name "${POD_NAME}" \
  --publish 27017:27017 \
  --publish 10000:10000 \
  --publish 10001:10001 \
  --publish 10002:10002 \
  --publish 7072:7072

echo "Starting MongoDB..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-mongodb-trustee-verification-remap \
  mongo:7.0 --bind_ip_all

echo "Starting Azurite..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-azurite-trustee-verification-remap \
  mcr.microsoft.com/azure-storage/azurite:3.21.0 \
  azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 --location /data --skipApiVersionCheck

echo "Waiting for MongoDB..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/27017' 2>/dev/null; then
    echo "  MongoDB ready"
    break
  fi
  [ "$i" -eq 30 ] && echo "ERROR: MongoDB failed to start" && exit 1
  sleep 1
done

echo "Waiting for Azurite..."
for i in $(seq 1 15); do
  if bash -c '</dev/tcp/localhost/10000' 2>/dev/null; then
    echo "  Azurite ready"
    break
  fi
  [ "$i" -eq 15 ] && echo "ERROR: Azurite failed to start" && exit 1
  sleep 1
done

echo "Starting dataflows function app..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-dataflows-trustee-verification-remap \
  "${IMAGE}"

echo "Waiting for dataflows function app..."
for i in $(seq 1 60); do
  if bash -c '</dev/tcp/localhost/7072' 2>/dev/null; then
    echo "  Dataflows ready"
    break
  fi
  [ "$i" -eq 60 ] && echo "ERROR: Dataflows function app failed to start" && exit 1
  sleep 2
done

echo ""
echo "All services ready."
echo "  MongoDB   → localhost:27017"
echo "  Azurite   → localhost:10001 (queue endpoint)"
echo "  Dataflows → localhost:7072"
echo ""
echo "Run stop-services.sh to tear down."
