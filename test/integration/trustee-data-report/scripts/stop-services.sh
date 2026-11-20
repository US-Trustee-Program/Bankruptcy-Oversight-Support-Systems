#!/bin/bash
# Tear down the trustee-data-report integration test infrastructure.

POD_NAME="cams-trustee-data-report-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f \
  cams-mongodb-trustee-data-report \
  cams-sqledge-trustee-data-report \
  cams-azurite-trustee-data-report \
  cams-dataflows-trustee-data-report 2>/dev/null || true

echo "Services stopped."
