#!/bin/bash
# Tear down query-builder integration test infrastructure.

POD_NAME="cams-query-builder-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-query-builder-mongodb 2>/dev/null || true

echo "Services stopped."
