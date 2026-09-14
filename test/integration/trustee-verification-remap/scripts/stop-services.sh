#!/bin/bash
# Tear down the trustee-verification-remap integration test infrastructure.

POD_NAME="cams-trustee-verification-remap-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f \
  cams-mongodb-trustee-verification-remap \
  cams-azurite-trustee-verification-remap \
  cams-dataflows-trustee-verification-remap 2>/dev/null || true

echo "Services stopped."
