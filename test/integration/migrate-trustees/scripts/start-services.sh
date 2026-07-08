#!/bin/bash
# Start local infrastructure for migrate-trustees integration tests.
# Runs MongoDB and SQL Edge in standalone containers (no pod required —
# no function app needed since the harness calls use-case functions directly).
#
# Usage:
#   ./start-services.sh         # start containers
#   ./stop-services.sh          # tear down
#
# After this script exits cleanly:
#   SQL Edge  → localhost:1433  (sa / YourStrong!Passw0rd from scripts/.env)
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

SQLEDGE_PASS="${MSSQL_PASS}"

podman rm -f \
  cams-migrate-trustees-mongodb \
  cams-migrate-trustees-sqledge 2>/dev/null || true

echo "Starting MongoDB..."
podman run -d \
  --name cams-migrate-trustees-mongodb \
  -p 27017:27017 \
  mongo:7.0 --bind_ip_all

echo "Starting SQL Edge..."
podman run -d \
  --name cams-migrate-trustees-sqledge \
  -p 1433:1433 \
  -e ACCEPT_EULA=Y \
  -e MSSQL_SA_PASSWORD="${SQLEDGE_PASS}" \
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

# Give SQL Edge a few extra seconds for the engine to be fully initialized
sleep 5

echo ""
echo "All services ready."
echo "  SQL Edge  → localhost:1433  (user=sa)"
echo "  MongoDB   → localhost:27017"
echo ""
echo "Next steps:"
echo "  cd test/integration"
echo "  npm run migrate-trustees -- seed-schema"
echo "  npm run migrate-trustees -- seed-sql"
echo "  npm run migrate-trustees -- run"
echo "  npm run migrate-trustees -- clean"
echo "  ./scripts/stop-services.sh"
