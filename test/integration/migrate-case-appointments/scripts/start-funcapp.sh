#!/bin/bash
# Start the dataflows function app wired to local Azurite + MongoDB containers.
#
# This script temporarily swaps local.settings.json with the integration
# settings file (Azurite + local Mongo), starts the function app, and
# restores the original settings on exit (Ctrl+C or error).
#
# Usage:
#   ./start-funcapp.sh
#
# Prerequisites:
#   - Containers running (./start-services.sh)
#   - Run from any directory (uses repo-relative paths)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
DATAFLOWS_DIR="$REPO_ROOT/backend/function-apps/dataflows"
INTEGRATION_SETTINGS="$SCRIPT_DIR/../local.settings.integration.json"
ORIGINAL_SETTINGS="$DATAFLOWS_DIR/local.settings.json"
BACKUP_SETTINGS="$DATAFLOWS_DIR/local.settings.json.bak"

if [ ! -f "$INTEGRATION_SETTINGS" ]; then
  echo "ERROR: $INTEGRATION_SETTINGS not found" >&2
  exit 1
fi

# Restore original settings on exit
restore_settings() {
  if [ -f "$BACKUP_SETTINGS" ]; then
    mv "$BACKUP_SETTINGS" "$ORIGINAL_SETTINGS"
    echo ""
    echo "Restored local.settings.json"
  fi
}
trap restore_settings EXIT INT TERM

# Swap settings
cp "$ORIGINAL_SETTINGS" "$BACKUP_SETTINGS"
cp "$INTEGRATION_SETTINGS" "$ORIGINAL_SETTINGS"
echo "Using integration settings (Azurite + local MongoDB)"

# Build and start
cd "$DATAFLOWS_DIR"
npm start
