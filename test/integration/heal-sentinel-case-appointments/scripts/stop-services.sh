#!/bin/bash
# Tear down the heal-sentinel-case-appointments integration harness infrastructure.

POD_NAME="cams-heal-sentinel-case-appointments-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f \
  cams-mongodb-heal-sentinel-case-appointments \
  cams-azurite-heal-sentinel-case-appointments \
  cams-dataflows-heal-sentinel-case-appointments 2>/dev/null || true

echo "Services stopped."
