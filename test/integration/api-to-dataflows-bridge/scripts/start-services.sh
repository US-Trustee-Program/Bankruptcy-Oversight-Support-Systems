#!/bin/bash
# Start local infrastructure for api-to-dataflows-bridge integration tests.
# Runs Azurite (Azure Storage emulator, queue service only) in a standalone container.
#
# After this script exits cleanly:
#   Azurite queue → localhost:10001

set -e

CONTAINER_NAME=cams-api-to-dataflows-bridge-azurite

podman rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "Starting Azurite..."
podman run -d \
  --name "$CONTAINER_NAME" \
  -p 10001:10001 \
  mcr.microsoft.com/azure-storage/azurite:3.21.0 \
  azurite-queue --queueHost 0.0.0.0 --skipApiVersionCheck

echo "Waiting for Azurite..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/10001' 2>/dev/null; then
    echo "  Azurite ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Azurite failed to start"
    podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo ""
echo "Services ready."
echo "  Azurite queue → localhost:10001"
echo ""
echo "From api-to-dataflows-bridge/ (one level up): cp scripts/.env.template .env.local"
echo "Then run the harness from test/integration/."
echo "Run stop-services.sh to tear down."
