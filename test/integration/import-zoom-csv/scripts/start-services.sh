#!/bin/bash
# Start local infrastructure for import-zoom-csv integration tests.
# Runs MongoDB and Azurite (Azure Blob Storage emulator) in standalone containers.
#
# After this script exits cleanly:
#   Azurite blob → localhost:10000
#   MongoDB      → localhost:27017

set -e

podman rm -f \
  cams-import-zoom-csv-mongodb \
  cams-import-zoom-csv-azurite 2>/dev/null || true

echo "Starting MongoDB..."
podman run -d \
  --name cams-import-zoom-csv-mongodb \
  -p 27017:27017 \
  mongo:7.0 --bind_ip_all

echo "Starting Azurite..."
podman run -d \
  --name cams-import-zoom-csv-azurite \
  -p 10000:10000 \
  mcr.microsoft.com/azure-storage/azurite:latest \
  azurite-blob --blobHost 0.0.0.0 --skipApiVersionCheck

echo "Waiting for MongoDB..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/27017' 2>/dev/null; then
    echo "  MongoDB ready"
    break
  fi
  [ "$i" -eq 30 ] && echo "ERROR: MongoDB failed to start" && exit 1
  sleep 1
done

echo "Waiting for Azurite..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/10000' 2>/dev/null; then
    echo "  Azurite ready"
    break
  fi
  [ "$i" -eq 30 ] && echo "ERROR: Azurite failed to start" && exit 1
  sleep 1
done

echo ""
echo "All services ready."
echo "  Azurite blob → localhost:10000"
echo "  MongoDB      → localhost:27017"
echo ""
echo "Next steps:"
echo "  1. cp import-zoom-csv/scripts/.env.template import-zoom-csv/scripts/.env.local"
echo "  2. Set AzureWebJobsStorage in .env.local using the Azurite well-known connection string:"
echo "     https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite#well-known-storage-account-and-key"
echo "  3. cd test/integration && npm run import-zoom-csv -- run"
echo "  4. npm run import-zoom-csv -- clean"
echo "  5. ./import-zoom-csv/scripts/stop-services.sh"
