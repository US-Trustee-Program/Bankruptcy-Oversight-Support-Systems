#!/bin/bash
# Tear down trustee-case-filter integration test infrastructure.

POD_NAME="cams-trustee-case-filter-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-trustee-case-filter-mongodb 2>/dev/null || true

echo "Services stopped."
