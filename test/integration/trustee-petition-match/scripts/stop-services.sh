#!/bin/bash
# Stop and remove trustee-petition-match local infrastructure containers.

set -e

echo "Stopping trustee-petition-match containers..."

podman stop \
  cams-trustee-petition-match-mongodb \
  cams-trustee-petition-match-sqledge 2>/dev/null || true

podman rm \
  cams-trustee-petition-match-mongodb \
  cams-trustee-petition-match-sqledge 2>/dev/null || true

echo "Done."
