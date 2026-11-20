#!/bin/bash
# Start local infrastructure for trustee-data-report integration tests.
# Runs MongoDB, SQL Edge, Azurite, and the dataflows function app in a shared
# Podman pod (localhost networking).
#
# Usage:
#   ./start-services.sh         # build image (if needed) and start all services
#   ./stop-services.sh          # tear down
#
# After this script exits cleanly all services are accepting connections:
#   SQL Edge  → localhost:1433  (sa / <MSSQL_PASS from scripts/.env>)
#   MongoDB   → localhost:27017
#   Azurite   → localhost:10001 (queue endpoint)
#   Dataflows → localhost:7072

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"

if [ -f "${SCRIPT_DIR}/.env" ]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/.env"
fi

if [ -z "${MSSQL_PASS}" ]; then
  echo "ERROR: MSSQL_PASS is not set. Copy scripts/.env.template to scripts/.env and populate it." >&2
  exit 1
fi

POD_NAME="cams-trustee-data-report-pod"
SQLEDGE_PASS="${MSSQL_PASS}"
IMAGE="localhost/integration_dataflows_trustee_data_report:latest"

# Build the dataflows image if it doesn't exist or source has changed
echo "Building dataflows image..."
podman build -t "${IMAGE}" \
  -f "${SCRIPT_DIR}/../Dockerfile.dataflows" \
  "${REPO_ROOT}"

# Clean up any previous run
podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f \
  cams-mongodb-trustee-data-report \
  cams-sqledge-trustee-data-report \
  cams-azurite-trustee-data-report \
  cams-dataflows-trustee-data-report 2>/dev/null || true

echo "Creating pod ${POD_NAME}..."
podman pod create \
  --name "${POD_NAME}" \
  --publish 127.0.0.1:1433:1433 \
  --publish 127.0.0.1:27017:27017 \
  --publish 127.0.0.1:10000:10000 \
  --publish 127.0.0.1:10001:10001 \
  --publish 127.0.0.1:10002:10002 \
  --publish 127.0.0.1:7072:7072

echo "Starting MongoDB..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-mongodb-trustee-data-report \
  mongo:7.0 --bind_ip_all

echo "Starting SQL Edge..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-sqledge-trustee-data-report \
  -e ACCEPT_EULA=Y \
  -e MSSQL_SA_PASSWORD="${SQLEDGE_PASS}" \
  -e MSSQL_PID=Developer \
  mcr.microsoft.com/azure-sql-edge:latest

echo "Starting Azurite..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-azurite-trustee-data-report \
  mcr.microsoft.com/azure-storage/azurite:3.21.0 \
  azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 --location /data --skipApiVersionCheck

# Readiness comes from each container's own "ready" log line, not a TCP probe from the host:
# on macOS the Podman port forwarder accepts a connection on a published port before anything in
# the container is listening, so a host-side /dev/tcp check passes immediately.
wait_for_log() {
  local name="$1" container="$2" pattern="$3" attempts="$4" interval="$5"
  echo "Waiting for ${name}..."
  for _ in $(seq 1 "${attempts}"); do
    if podman logs "${container}" 2>&1 | grep -qE "${pattern}"; then
      echo "  ${name} ready"
      return 0
    fi
    sleep "${interval}"
  done
  echo "ERROR: ${name} failed to start" >&2
  exit 1
}

wait_for_log "SQL Edge" cams-sqledge-trustee-data-report \
  'SQL Server is now ready for client connections' 60 2
wait_for_log "MongoDB" cams-mongodb-trustee-data-report \
  'Waiting for connections' 30 1
wait_for_log "Azurite" cams-azurite-trustee-data-report \
  'Azurite Queue service is successfully listening' 15 1

echo "Starting dataflows function app..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-dataflows-trustee-data-report \
  "${IMAGE}"

wait_for_log "Dataflows function app" cams-dataflows-trustee-data-report \
  'Host started' 90 2

echo ""
echo "All services ready."
echo "  SQL Edge  → localhost:1433  (user=sa)"
echo "  MongoDB   → localhost:27017"
echo "  Azurite   → localhost:10001 (queue endpoint)"
echo "  Dataflows → localhost:7072"
echo ""
echo "Run stop-services.sh to tear down."
