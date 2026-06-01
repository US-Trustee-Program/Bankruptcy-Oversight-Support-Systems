#!/bin/bash
# Tear down the ACMS-CAMS transition integration test infrastructure.

POD_NAME="cams-integration-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-integration-sqledge cams-integration-mongodb cams-integration-azurite 2>/dev/null || true

echo "Services stopped."
