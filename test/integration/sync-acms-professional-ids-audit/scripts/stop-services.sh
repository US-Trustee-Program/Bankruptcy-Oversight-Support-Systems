#!/bin/bash
# Tear down sync-acms-professional-ids-audit backtest infrastructure.

POD_NAME="cams-876-replay-pod"

podman pod stop  "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-876-replay-mongodb 2>/dev/null || true

echo "Services stopped."
