#!/bin/bash
# Runs the real Azure Functions host (func start) against ui-sandbox's local.settings.json
# (real okta-gateway.ts code path pointed at the fake-okta server, localhost Mongo + SQL Edge).
# This is a containerized-equivalent, built API - no hot reload on backend changes; re-run
# `npm run build:common && npm run build:api --workspace=backend` and restart this script after
# editing backend source. (The ui-sandbox only hot-reloads the frontend; see launch.sh.)
#
# backend/function-apps/api/local.settings.json holds real dev Azure Storage credentials and is
# gitignored - never overwritten in place. This script swaps it out for the sandbox's version
# only for the lifetime of this process and restores the original on exit (including Ctrl-C).
set -e

# See launch.sh's own guard comment - untested outside macOS, fail fast rather than risk this
# script's credentials-file restore silently not running on a signal it doesn't expect.
if [ "$(uname -s)" != "Darwin" ]; then
  echo "ui-sandbox scripts are macOS-only currently (detected: $(uname -s)). Exiting." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="${SCRIPT_DIR}/../../../backend/function-apps/api"
REAL_SETTINGS="${API_DIR}/local.settings.json"
BACKUP_SETTINGS="${API_DIR}/local.settings.json.ui-sandbox-backup"
SANDBOX_SETTINGS="${SCRIPT_DIR}/../local.settings.json"

REAL_SETTINGS_EXISTED=false
if [ -f "${REAL_SETTINGS}" ]; then
  REAL_SETTINGS_EXISTED=true
  cp "${REAL_SETTINGS}" "${BACKUP_SETTINGS}"
fi

# Recursively signals a PID's descendants before the PID itself - func start (Azure Functions
# Core Tools) spawns its own child process and doesn't reliably die from only itself being
# signaled. macOS has no setsid to give it its own process group, so this walks the actual
# parent/child tree via pgrep instead. Same helper as launch.sh's own copy.
kill_tree() {
  local parent="$1"
  local sig="$2"
  local child
  for child in $(pgrep -P "${parent}" 2>/dev/null); do
    kill_tree "${child}" "${sig}"
  done
  kill "-${sig}" "${parent}" 2>/dev/null || true
}

FUNC_PID=""
restore() {
  if [ -n "${FUNC_PID}" ]; then
    kill_tree "${FUNC_PID}" TERM
    for _ in $(seq 1 20); do
      kill -0 "${FUNC_PID}" 2>/dev/null || break
      sleep 0.5
    done
    kill_tree "${FUNC_PID}" KILL
  fi
  if [ "${REAL_SETTINGS_EXISTED}" = true ]; then
    mv "${BACKUP_SETTINGS}" "${REAL_SETTINGS}"
  else
    # No original file existed before launch - remove the sandbox-created one instead of
    # leaving it stranded (there's nothing to restore it to).
    rm -f "${REAL_SETTINGS}"
  fi
}
trap restore EXIT INT TERM

cp "${SANDBOX_SETTINGS}" "${REAL_SETTINGS}"

cd "${API_DIR}"
func start --javascript &
FUNC_PID=$!
wait "${FUNC_PID}"
