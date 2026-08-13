#!/bin/bash
# Start local infrastructure for backfill-trustee-professional-ids integration tests.
# Runs MongoDB (Cosmos stand-in) and SQL Edge (mimicking ACMS) in standalone containers — no
# pod, no function app, since the harness calls the gateway + use-case functions directly (no
# dataflow handler exists yet for this epic — see README.md's scope note).
#
# Usage:
#   ./start-services.sh         # start containers
#   ./stop-services.sh          # tear down
#
# After this script exits cleanly:
#   SQL Edge  → localhost:1433  (sa / password from scripts/.env)
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
  cams-mongodb-backfill-trustee-professional-ids \
  cams-sqledge-backfill-trustee-professional-ids 2>/dev/null || true

echo "Starting MongoDB..."
podman run -d \
  --name cams-mongodb-backfill-trustee-professional-ids \
  -p 27017:27017 \
  mongo:7.0 --bind_ip_all

echo "Starting SQL Edge..."
podman run -d \
  --name cams-sqledge-backfill-trustee-professional-ids \
  -p 1433:1433 \
  -e ACCEPT_EULA=Y \
  -e MSSQL_SA_PASSWORD="${MSSQL_PASS}" \
  -e MSSQL_PID=Developer \
  mcr.microsoft.com/azure-sql-edge:latest

wait_for_port() {
  local host=$1 port=$2 label=$3
  echo "Waiting for $label..."
  for i in $(seq 1 60); do
    if bash -c "</dev/tcp/${host}/${port}" 2>/dev/null; then
      echo "  ✓ $label ready"
      return 0
    fi
    [ "$i" -eq 60 ] && echo "ERROR: $label did not start" >&2 && exit 1
    sleep 2
  done
}

wait_for_port localhost 1433 "SQL Edge"
wait_for_port localhost 27017 "MongoDB"

# Give SQL Edge a few extra seconds for the engine to be fully initialized.
sleep 5

echo ""
echo "All services ready."
echo "  SQL Edge  → localhost:1433  (user=sa)"
echo "  MongoDB   → localhost:27017"
echo ""
echo "Next steps (from test/integration/):"
echo "  npm run backfill-trustee-professional-ids -- seed-schema"
echo "  npm run backfill-trustee-professional-ids -- seed-sql"
echo "  npm run backfill-trustee-professional-ids -- seed-cosmos"
echo "  npm run backfill-trustee-professional-ids -- run"
echo "  npm run backfill-trustee-professional-ids -- clean"
echo "  ./scripts/stop-services.sh"
