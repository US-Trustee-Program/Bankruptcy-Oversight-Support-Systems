#!/bin/bash
# Start local infrastructure for the ustDivisionCode backfill integration harness.
# Runs MongoDB (Cosmos stand-in) and SQL Edge (DXTR stand-in) as standalone containers —
# no pod and no function app, since the harness calls the use-case functions directly.
#
# SQL Edge is required, not optional: backfill-appointment-ust-division-codes resolves its
# ACMS -> bare code map from OfficesDxtrGateway.getOffices(), and the harness's run-offices
# command is the only place ustDivisionCodeSelect's CASE expression is proven against a real
# database rather than asserted as SQL text.
#
# Usage:
#   ./start-services.sh         # start containers
#   ./stop-services.sh          # tear down
#
# After this script exits cleanly:
#   SQL Edge  → localhost:1433  (sa / MSSQL_PASS from scripts/.env)
#   MongoDB   → localhost:27017

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

podman rm -f \
  cams-ust-division-backfills-mongodb \
  cams-ust-division-backfills-sqledge 2>/dev/null || true

echo "Starting MongoDB..."
podman run -d \
  --name cams-ust-division-backfills-mongodb \
  -p 27017:27017 \
  mongo:7.0 --bind_ip_all

echo "Starting SQL Edge..."
podman run -d \
  --name cams-ust-division-backfills-sqledge \
  -p 1433:1433 \
  -e ACCEPT_EULA=Y \
  -e MSSQL_SA_PASSWORD="${MSSQL_PASS}" \
  -e MSSQL_PID=Developer \
  mcr.microsoft.com/azure-sql-edge:latest

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

# The port accepts connections before the engine finishes initializing; CREATE DATABASE in
# seed-schema fails if it runs too early.
sleep 5

echo ""
echo "All services ready."
echo "  SQL Edge  → localhost:1433  (user=sa)"
echo "  MongoDB   → localhost:27017"
echo ""
echo "Next steps:"
echo "  cd test/integration"
echo "  cp ust-division-backfills/.env.local.template ust-division-backfills/.env.local"
echo "  npm run ust-division-backfills -- seed-schema"
echo "  npm run ust-division-backfills -- seed-sql"
echo "  npm run ust-division-backfills -- run-all"
echo "  npm run ust-division-backfills -- clean"
echo "  ./ust-division-backfills/scripts/stop-services.sh"
