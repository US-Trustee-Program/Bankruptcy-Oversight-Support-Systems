#!/bin/bash
# Stop and remove migrate-trustees local infrastructure containers.

set -e

echo "Stopping migrate-trustees containers..."

podman stop \
  cams-migrate-trustees-mongodb \
  cams-migrate-trustees-sqledge 2>/dev/null || true

podman rm \
  cams-migrate-trustees-mongodb \
  cams-migrate-trustees-sqledge 2>/dev/null || true

echo "Done."
