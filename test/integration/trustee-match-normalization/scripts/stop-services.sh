#!/bin/bash
# Tear down trustee-match-normalization integration test infrastructure.

POD_NAME="cams-tmn-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-tmn-mongodb 2>/dev/null || true

echo "Services stopped."
