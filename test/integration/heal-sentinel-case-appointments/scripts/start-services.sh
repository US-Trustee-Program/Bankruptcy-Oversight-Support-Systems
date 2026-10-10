#!/bin/bash
# Start local infrastructure for the heal-sentinel-case-appointments integration harness.
# Runs MongoDB, Azurite, and the real dataflows function app in one Podman pod (shared
# localhost). No SQL Edge: this dataflow reads and writes only MongoDB and the storage queues.
#
# Inside the pod every service listens on its default port; only the host-side published ports
# differ, so this pod can run alongside the sync-acms-professional-ids pod and the
# cams-local-infra containers.
#
# Usage:
#   ./start-services.sh         # build image and start all services
#   ./stop-services.sh          # tear down
#
# Host ports (override with the environment variables shown):
#   MongoDB   -> localhost:${HEAL_MONGO_PORT:-27317}
#   Azurite   -> localhost:${HEAL_AZURITE_BLOB_PORT:-10300} (blob), ${HEAL_AZURITE_QUEUE_PORT:-10301} (queue), ${HEAL_AZURITE_TABLE_PORT:-10302} (table)
#   Dataflows -> localhost:${HEAL_DATAFLOWS_PORT:-7372}

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"

POD_NAME="cams-heal-sentinel-case-appointments-pod"
IMAGE="localhost/integration_dataflows_heal_sentinels:latest"
MONGO_CONTAINER="cams-mongodb-heal-sentinel-case-appointments"
AZURITE_CONTAINER="cams-azurite-heal-sentinel-case-appointments"
DATAFLOWS_CONTAINER="cams-dataflows-heal-sentinel-case-appointments"

MONGO_PORT="${HEAL_MONGO_PORT:-27317}"
BLOB_PORT="${HEAL_AZURITE_BLOB_PORT:-10300}"
QUEUE_PORT="${HEAL_AZURITE_QUEUE_PORT:-10301}"
TABLE_PORT="${HEAL_AZURITE_TABLE_PORT:-10302}"
DATAFLOWS_PORT="${HEAL_DATAFLOWS_PORT:-7372}"

wait_for_port() {
  local label="$1" port="$2" attempts="$3" interval="$4"
  for _ in $(seq 1 "${attempts}"); do
    if bash -c "</dev/tcp/localhost/${port}" 2>/dev/null; then
      echo "  ${label} ready"
      return 0
    fi
    sleep "${interval}"
  done
  echo "ERROR: ${label} did not accept connections on localhost:${port}" >&2
  exit 1
}

echo "Building dataflows image (copies the current backend/ and common/ working tree)..."
podman build -t "${IMAGE}" \
  --ignorefile "${SCRIPT_DIR}/../Dockerfile.dataflows.dockerignore" \
  -f "${SCRIPT_DIR}/../Dockerfile.dataflows" \
  "${REPO_ROOT}"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f "${MONGO_CONTAINER}" "${AZURITE_CONTAINER}" "${DATAFLOWS_CONTAINER}" 2>/dev/null || true

echo "Creating pod ${POD_NAME}..."
podman pod create \
  --name "${POD_NAME}" \
  --publish "127.0.0.1:${MONGO_PORT}:27017" \
  --publish "127.0.0.1:${BLOB_PORT}:10000" \
  --publish "127.0.0.1:${QUEUE_PORT}:10001" \
  --publish "127.0.0.1:${TABLE_PORT}:10002" \
  --publish "127.0.0.1:${DATAFLOWS_PORT}:7072"

echo "Starting MongoDB..."
podman run -d \
  --pod "${POD_NAME}" \
  --name "${MONGO_CONTAINER}" \
  mongo:7.0 --bind_ip_all

echo "Starting Azurite..."
podman run -d \
  --pod "${POD_NAME}" \
  --name "${AZURITE_CONTAINER}" \
  mcr.microsoft.com/azure-storage/azurite:3.21.0 \
  azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 --location /data --skipApiVersionCheck

echo "Waiting for MongoDB..."
wait_for_port "MongoDB" "${MONGO_PORT}" 30 1
echo "Waiting for Azurite..."
wait_for_port "Azurite" "${QUEUE_PORT}" 15 1

echo "Starting dataflows function app..."
podman run -d \
  --pod "${POD_NAME}" \
  --name "${DATAFLOWS_CONTAINER}" \
  "${IMAGE}"

echo "Waiting for dataflows function app..."
wait_for_port "Dataflows" "${DATAFLOWS_PORT}" 60 2

echo ""
echo "All services ready."
echo "  MongoDB   -> localhost:${MONGO_PORT}"
echo "  Azurite   -> localhost:${QUEUE_PORT} (queue endpoint)"
echo "  Dataflows -> localhost:${DATAFLOWS_PORT}"
echo ""
echo "Run stop-services.sh to tear down."
