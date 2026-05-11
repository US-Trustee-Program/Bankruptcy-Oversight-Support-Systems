#!/bin/bash
# Start local infrastructure for ACMS-CAMS transition integration tests.
# Runs SQL Edge, MongoDB, and Azurite in a shared Podman pod (localhost networking).
#
# Usage:
#   ./start-services.sh         # start and wait for ready
#   ./stop-services.sh          # tear down
#
# After this script exits cleanly all three services are accepting connections:
#   SQL Edge  → localhost:1433  (sa / YourStrong!Passw0rd)
#   MongoDB   → localhost:27017
#   Azurite   → localhost:10001 (queue endpoint)

set -e

POD_NAME="cams-integration-pod"
SQLEDGE_PASS="${MSSQL_PASS:-YourStrong!Passw0rd}"

# Clean up any previous run
podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-integration-sqledge cams-integration-mongodb cams-integration-azurite 2>/dev/null || true

echo "Creating pod ${POD_NAME}..."
podman pod create \
  --name "${POD_NAME}" \
  --publish 1433:1433 \
  --publish 27017:27017 \
  --publish 10000:10000 \
  --publish 10001:10001 \
  --publish 10002:10002

echo "Starting SQL Edge..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-integration-sqledge \
  -e ACCEPT_EULA=Y \
  -e MSSQL_SA_PASSWORD="${SQLEDGE_PASS}" \
  -e MSSQL_PID=Developer \
  mcr.microsoft.com/azure-sql-edge:latest

echo "Starting MongoDB..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-integration-mongodb \
  mongo:7.0 --bind_ip_all

echo "Starting Azurite..."
podman run -d \
  --pod "${POD_NAME}" \
  --name cams-integration-azurite \
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
echo "  SQL Edge  → localhost:1433  (user=sa, pass=${SQLEDGE_PASS})"
echo "  MongoDB   → localhost:27017"
echo "  Azurite   → localhost:10001 (queue endpoint)"
echo ""
echo "Run stop-services.sh to tear down."
