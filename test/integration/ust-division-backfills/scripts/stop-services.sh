#!/bin/bash
# Tear down the ustDivisionCode backfill harness containers.
#
# Usage:
#   ./stop-services.sh

set -e

echo "Stopping and removing containers..."
podman rm -f \
  cams-ust-division-backfills-mongodb \
  cams-ust-division-backfills-sqledge 2>/dev/null || true

echo "Done. Containers removed; no volumes were created, so no data persists."
