#!/bin/bash
# Stop and remove import-zoom-csv local infrastructure containers.

set -e

echo "Stopping import-zoom-csv containers..."

podman stop \
  cams-import-zoom-csv-mongodb \
  cams-import-zoom-csv-azurite 2>/dev/null || true

podman rm \
  cams-import-zoom-csv-mongodb \
  cams-import-zoom-csv-azurite 2>/dev/null || true

echo "Done."
