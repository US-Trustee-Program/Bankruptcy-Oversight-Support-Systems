#!/bin/bash
# Stop and remove backfill-trustee-professional-ids local infrastructure containers.

set -e

echo "Stopping backfill-trustee-professional-ids containers..."

podman stop \
  cams-mongodb-backfill-trustee-professional-ids \
  cams-sqledge-backfill-trustee-professional-ids 2>/dev/null || true

podman rm \
  cams-mongodb-backfill-trustee-professional-ids \
  cams-sqledge-backfill-trustee-professional-ids 2>/dev/null || true

echo "Done."
