#!/bin/bash
# Tear down the sync-acms-professional-ids integration test infrastructure.

POD_NAME="cams-sync-acms-professional-ids-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f \
  cams-mongodb-sync-acms-professional-ids \
  cams-sqledge-sync-acms-professional-ids \
  cams-azurite-sync-acms-professional-ids \
  cams-dataflows-sync-acms-professional-ids 2>/dev/null || true

echo "Services stopped."
