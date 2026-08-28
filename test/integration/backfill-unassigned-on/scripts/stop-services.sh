#!/bin/bash
# Tear down backfill-unassigned-on integration test infrastructure.

POD_NAME="cams-backfill-unassigned-on-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-backfill-unassigned-on-mongodb 2>/dev/null || true

echo "Services stopped."
