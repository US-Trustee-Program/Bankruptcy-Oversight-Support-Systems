#!/bin/bash
# Start local MongoDB + SQL Edge for the ui-sandbox — no pod, no Azurite, since the
# sandbox drives the Functions host + Vite dev server directly on the host for hot reload.
# SQL Edge is required even for Mongo-backed screens like trustee-match-verification: the
# list endpoint's courtName enrichment calls CourtsUseCase -> OfficesUseCase -> the real
# OfficesDxtrGateway, which queries DXTR office/court tables (AO_CS_DIV/AO_OFFICE/AO_COURT/
# AO_GRP_DES/AO_REGION) whenever DATABASE_MOCK=false.
#
# Usage:
#   ./start-services.sh   # start containers
#   ./stop-services.sh    # tear down
#
# After this script exits cleanly:
#   MongoDB  → localhost:27017
#   SQL Edge → localhost:1433 (sa / see MSSQL_PASS in ../local.settings.json)

set -e

MSSQL_PASS='YourStrong!Passw0rd'

podman rm -f cams-ui-sandbox-mongodb cams-ui-sandbox-sqledge 2>/dev/null || true

echo "Starting MongoDB..."
podman run -d \
  --name cams-ui-sandbox-mongodb \
  -p 27017:27017 \
  mongo:7.0 --bind_ip_all

echo "Starting SQL Edge..."
podman run -d \
  --name cams-ui-sandbox-sqledge \
  -p 1433:1433 \
  -e ACCEPT_EULA=Y \
  -e MSSQL_SA_PASSWORD="${MSSQL_PASS}" \
  -e MSSQL_PID=Developer \
  mcr.microsoft.com/azure-sql-edge:latest

echo "Waiting for MongoDB..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/27017' 2>/dev/null; then
    echo "  MongoDB ready"
    break
  fi
  [ "$i" -eq 30 ] && echo "ERROR: MongoDB failed to start" && exit 1
  sleep 1
done

echo "Waiting for SQL Edge..."
for i in $(seq 1 60); do
  if bash -c '</dev/tcp/localhost/1433' 2>/dev/null; then
    echo "  SQL Edge ready"
    break
  fi
  [ "$i" -eq 60 ] && echo "ERROR: SQL Edge failed to start" && exit 1
  sleep 2
done
sleep 5

echo ""
echo "MongoDB ready on localhost:27017, SQL Edge ready on localhost:1433."
echo ""
echo "Next steps (from test/ui-sandbox/):"
echo "  npm run seed:sql   (one-time DXTR office/court schema + rows)"
echo "  npm run seed"
echo "  source frontend.env && npm run start --workspace=backend/function-apps/api"
echo "  (separate terminal) source frontend.env && npm run start --workspace=user-interface"
echo "  ./scripts/stop-services.sh"
