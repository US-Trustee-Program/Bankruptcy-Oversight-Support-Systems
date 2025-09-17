#!/bin/bash

# Cleanup Script for Containerized API
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="bankruptcy-api-container"

echo -e "${GREEN}🧹 Cleaning up bankruptcy API container and secrets...${NC}"

# Stop and remove container
if podman ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    echo -e "${YELLOW}🛑 Stopping container: $CONTAINER_NAME${NC}"
    podman stop "$CONTAINER_NAME"
fi

if podman ps -a -q -f name="$CONTAINER_NAME" | grep -q .; then
    echo -e "${YELLOW}🗑️  Removing container: $CONTAINER_NAME${NC}"
    podman rm "$CONTAINER_NAME"
fi

# Clean up secrets
echo -e "${GREEN}🔐 Cleaning up secrets...${NC}"
secret_count=0
for secret in $(podman secret ls --format "{{.Name}}" | grep "^${CONTAINER_NAME}_" || true); do
    echo "  🗑️  Removing secret: $secret"
    podman secret rm "$secret" >/dev/null 2>&1 || true
    ((secret_count++))
done

if [ $secret_count -eq 0 ]; then
    echo "  ✅ No secrets found to clean up"
else
    echo -e "${GREEN}  ✅ Cleaned up $secret_count secrets${NC}"
fi

echo -e "${GREEN}✅ Cleanup completed!${NC}"
