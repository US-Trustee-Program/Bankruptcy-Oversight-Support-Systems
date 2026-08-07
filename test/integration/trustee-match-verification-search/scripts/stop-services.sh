#!/bin/bash
# Tear down trustee-match-verification-search integration test infrastructure.

POD_NAME="cams-tmv-search-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-tmv-search-mongodb 2>/dev/null || true

echo "Services stopped."
