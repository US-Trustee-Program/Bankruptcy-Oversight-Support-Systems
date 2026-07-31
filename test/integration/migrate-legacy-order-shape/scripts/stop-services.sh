#!/bin/bash
# Tear down migrate-legacy-order-shape integration test infrastructure.

POD_NAME="cams-migrate-legacy-order-shape-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-migrate-legacy-order-shape-mongodb 2>/dev/null || true

echo "Services stopped."
