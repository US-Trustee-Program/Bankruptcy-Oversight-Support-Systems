#!/bin/bash
# Tear down case-trustee-appointments integration test infrastructure.

POD_NAME="cams-trustee-appt-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-trustee-appt-mongodb 2>/dev/null || true

echo "Services stopped."
