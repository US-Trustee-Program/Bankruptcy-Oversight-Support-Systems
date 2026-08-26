#!/bin/bash
# Start local infrastructure for api-to-dataflows-bridge integration tests.
# Runs Azurite (Azure Storage emulator, queue service only) in a standalone container.
#
# After this script exits cleanly:
#   Azurite queue → localhost:10001

set -e

podman rm -f cams-api-to-dataflows-bridge-azurite 2>/dev/null || true

echo "Starting Azurite..."
podman run -d \
  --name cams-api-to-dataflows-bridge-azurite \
  -p 10001:10001 \
  mcr.microsoft.com/azure-storage/azurite:latest \
  azurite-queue --queueHost 0.0.0.0 --skipApiVersionCheck

echo "Waiting for Azurite..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/10001' 2>/dev/null; then
    echo "  Azurite ready"
    break
  fi
  [ "$i" -eq 30 ] && echo "ERROR: Azurite failed to start" && exit 1
  sleep 1
done

echo ""
echo "Services ready."
echo "  Azurite queue → localhost:10001"
echo ""
echo "Copy .env.template to .env.local, then run the harness from test/integration/."
echo "Run stop-services.sh to tear down."
