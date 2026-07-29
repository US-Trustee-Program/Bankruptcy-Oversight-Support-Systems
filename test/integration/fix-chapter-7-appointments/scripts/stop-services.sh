#!/bin/bash
# Tear down fix-chapter-7-appointments integration test infrastructure.

POD_NAME="cams-fix-chapter-7-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-fix-chapter-7-mongodb 2>/dev/null || true

echo "Services stopped."
