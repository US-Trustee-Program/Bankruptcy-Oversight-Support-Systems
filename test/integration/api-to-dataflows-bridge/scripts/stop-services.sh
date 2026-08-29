#!/bin/bash
# Tear down api-to-dataflows-bridge integration test infrastructure.

podman rm -f cams-api-to-dataflows-bridge-azurite 2>/dev/null || true

echo "Services stopped."
