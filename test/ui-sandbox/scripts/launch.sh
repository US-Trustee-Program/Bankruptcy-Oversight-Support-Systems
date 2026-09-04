#!/bin/bash
# Thin launcher for the ui-sandbox: starts the fake-okta OIDC server, the built backend
# (func start against backend/function-apps/api/dist - rebuild after backend changes with
# `npm run build:common && npm run build:api --workspace=backend`), and the frontend Vite dev
# server (hot reload - this is the "ui" the sandbox name refers to). Assumes MongoDB + SQL Edge
# are already running (./start-services.sh) and seeded (npm run seed / seed:sql / seed-users) -
# this script only launches the three app processes, not the databases.
#
# Usage: ./launch.sh
# Ctrl-C stops all three processes together.

set -e

# macOS-specific: generate-cert.sh's openssl invocation, this script's process-tree teardown
# (no setsid available to give each job its own process group, so kill_tree below walks the
# actual parent/child tree via pgrep instead), and the whole team is on MacBook Pros - so this
# hasn't been tested or written for Linux/other. Fail fast with a clear message rather than limp
# along with subtly wrong signal/process handling on an untested OS.
if [ "$(uname -s)" != "Darwin" ]; then
  echo "ui-sandbox scripts are macOS-only currently (detected: $(uname -s)). Exiting." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SANDBOX_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SANDBOX_DIR}/../.." && pwd)"

if [ ! -f "${SANDBOX_DIR}/fake-okta/certs/cert.pem" ]; then
  echo "No TLS cert found - generating one now..."
  "${SCRIPT_DIR}/generate-cert.sh"
fi

# Recursively signals a PID's descendants before the PID itself - killing just the backgrounded
# subshell PID isn't reliable here, since func start (Azure Functions Core Tools) and vite (a
# `sh -c` wrapper around a node process) both spawn child processes that don't reliably die from
# only their immediate parent receiving a signal. macOS has no setsid to give each job its own
# process group, so this walks the actual parent/child tree via pgrep instead.
kill_tree() {
  local parent="$1"
  local sig="$2"
  local child
  for child in $(pgrep -P "${parent}" 2>/dev/null); do
    kill_tree "${child}" "${sig}"
  done
  kill "-${sig}" "${parent}" 2>/dev/null || true
}

PIDS=()
cleanup() {
  echo ""
  echo "Stopping sandbox processes..."
  for pid in "${PIDS[@]}"; do
    kill_tree "${pid}" TERM
  done
  for pid in "${PIDS[@]}"; do
    for _ in $(seq 1 20); do
      kill -0 "${pid}" 2>/dev/null || break
      sleep 0.5
    done
    kill_tree "${pid}" KILL
  done
  podman rm -f cams-ui-sandbox-fake-okta 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Building fake-okta container..."
podman build -t cams-ui-sandbox-fake-okta -f "${SANDBOX_DIR}/fake-okta/Dockerfile" "${REPO_ROOT}"

echo "Starting fake-okta server (container) on https://localhost:8443 ..."
podman rm -f cams-ui-sandbox-fake-okta 2>/dev/null || true
# host.containers.internal resolves to the Podman VM's host-side gateway - the standalone Mongo/
# SQL Edge containers publish to the host's localhost, which this container can't reach as
# "localhost" the way a bare host process can.
podman run --rm --name cams-ui-sandbox-fake-okta \
  -p 8443:8443 \
  -e MONGO_CONNECTION_STRING="mongodb://host.containers.internal:27017/cams-e2e?retrywrites=false" \
  -v "${SANDBOX_DIR}/fake-okta/certs:/app/certs:ro" \
  cams-ui-sandbox-fake-okta &
PIDS+=($!)

echo "Starting backend (func start, built API) on http://localhost:7071 ..."
"${SCRIPT_DIR}/start-backend.sh" &
PIDS+=($!)

echo "Starting frontend (Vite, hot reload) on http://localhost:3000 ..."
(
  cd "${REPO_ROOT}/user-interface"
  # shellcheck source=/dev/null
  source "${SANDBOX_DIR}/frontend.env"
  npm run start
) &
PIDS+=($!)

echo ""
echo "All sandbox processes started. Ctrl-C to stop everything."
wait
