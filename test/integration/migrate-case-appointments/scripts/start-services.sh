#!/bin/bash
# Start local infrastructure for migrate-case-appointments integration tests.
# Runs MongoDB, SQL Edge, and Azurite in a shared Podman pod (localhost networking).
#
# Usage:
#   ./start-services.sh         # start and wait for ready
#   ./stop-services.sh          # tear down
#
# After this script exits cleanly all three services are accepting connections:
#   SQL Edge  → localhost:1433  (sa / <MSSQL_PASS from scripts/.env>)
#   MongoDB   → localhost:27017
#   Azurite   → localhost:10001 (queue endpoint)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.env" ]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/.env"
fi

if [ -z "${MSSQL_PASS}" ]; then
  echo "ERROR: MSSQL_PASS is not set. Copy scripts/.env.template to scripts/.env and populate it." >&2
  exit 1
fi

POD_NAME="cams-migrate-case-appointments-pod"
SQLEDGE_PASS="${MSSQL_PASS}"

# Clean up any previous run
podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-mongodb-migrate-case-appointments cams-sqledge-migrate-case-appointments cams-azurite-migrate-case-appointments 2>/dev/null || true

echo "Creating pod ${POD_NAME}..."
podman pod create \
  --name "${POD_NAME}" \
  --publish 1433:1433 \
  --publish 27017:27017 \
  --publish 10000:10000 \
  --publish 10001:10001 \
  --publish 10002:10002

echo "Starting MongoDB..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-mongodb-migrate-case-appointments \
  mongo:7.0 --bind_ip_all

echo "Starting SQL Edge..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-sqledge-migrate-case-appointments \
  -e ACCEPT_EULA=Y \
  -e MSSQL_SA_PASSWORD="${SQLEDGE_PASS}" \
  -e MSSQL_PID=Developer \
  mcr.microsoft.com/azure-sql-edge:latest

echo "Starting Azurite..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-azurite-migrate-case-appointments \
  mcr.microsoft.com/azure-storage/azurite:latest \
  azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 --location /data --skipApiVersionCheck

echo "Waiting for SQL Edge..."
for i in $(seq 1 60); do
  if bash -c '</dev/tcp/localhost/1433' 2>/dev/null; then
    echo "  SQL Edge ready"
    break
  fi
  [ "$i" -eq 60 ] && echo "ERROR: SQL Edge failed to start" && exit 1
  sleep 2
done

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

echo ""
echo "All services ready."
echo "  SQL Edge  → localhost:1433  (user=sa)"
echo "  MongoDB   → localhost:27017"
echo "  Azurite   → localhost:10001 (queue endpoint)"
echo ""
echo "Run stop-services.sh to tear down."
