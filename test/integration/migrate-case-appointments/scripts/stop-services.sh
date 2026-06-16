#!/bin/bash
# Tear down the migrate-case-appointments integration test infrastructure.

POD_NAME="cams-migrate-case-appointments-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-mongodb-migrate-case-appointments cams-sqledge-migrate-case-appointments cams-azurite-migrate-case-appointments 2>/dev/null || true

echo "Services stopped."
