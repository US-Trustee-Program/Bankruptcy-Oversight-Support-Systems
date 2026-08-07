#!/bin/bash
# Stop and remove trustee-match-scenarios local infrastructure containers.

set -e

echo "Stopping trustee-match-scenarios containers..."

podman stop \
  cams-trustee-match-scenarios-mongodb \
  cams-trustee-match-scenarios-sqledge 2>/dev/null || true

podman rm \
  cams-trustee-match-scenarios-mongodb \
  cams-trustee-match-scenarios-sqledge 2>/dev/null || true

echo "Done."
