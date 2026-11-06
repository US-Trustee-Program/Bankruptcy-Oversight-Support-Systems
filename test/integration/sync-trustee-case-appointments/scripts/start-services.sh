#!/bin/bash
# Local infrastructure for the sync-trustee-case-appointments harness: MongoDB + SQL Edge.
# SQL Edge hosts BOTH ACMS_INT and DXTR_INT. No Azurite and no function app: the harness calls
# use-case code in-process (see ../README.md).
#
# Usage: ./start-services.sh   (needs scripts/.env with MSSQL_PASS; see .env.template)
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

POD_NAME="cams-sync-trustee-case-appointments-pod"
podman pod stop "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true

# Bind to loopback only: MongoDB has no auth, and `replay` loads real trustee data into these containers.
podman pod create --name "${POD_NAME}" --publish 127.0.0.1:1433:1433 --publish 127.0.0.1:27017:27017

podman run -d --pod "${POD_NAME}" --name cams-mongodb-sync-trustee-case-appointments \
  docker.io/library/mongo:7.0.37 --bind_ip_all
podman run -d --pod "${POD_NAME}" --name cams-sqledge-sync-trustee-case-appointments \
  -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD="${MSSQL_PASS}" -e MSSQL_PID=Developer \
  mcr.microsoft.com/azure-sql-edge:1.0.7

wait_for_port() {
  local name="$1" port="$2" tries="$3" delay="$4"
  echo "Waiting for ${name}..."
  for i in $(seq 1 "${tries}"); do
    if bash -c "</dev/tcp/localhost/${port}" 2>/dev/null; then echo "  ${name} ready"; return 0; fi
    [ "$i" -eq "${tries}" ] && echo "ERROR: ${name} failed to start" && exit 1
    sleep "${delay}"
  done
}
wait_for_port "SQL Edge" 1433 60 2
wait_for_port "MongoDB" 27017 30 1

echo ""
echo "Ready: SQL Edge localhost:1433 (sa), MongoDB localhost:27017"
echo "Next: cd .. && cp .env.local.template .env.local (set passwords), then:"
echo "  npm run sync-trustee-case-appointments -- seed-schema"
