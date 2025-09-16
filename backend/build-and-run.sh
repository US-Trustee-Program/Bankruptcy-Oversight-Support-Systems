#!/bin/bash

# Build and Run Script for Containerized API
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="bankruptcy-api"
CONTAINER_NAME="bankruptcy-api-container"
PORT="8080"

echo -e "${GREEN}🐳 Building Container Image...${NC}"
echo "Image: $IMAGE_NAME"

# Build the container image from project root (to include common directory)
cd .. && podman build -t $IMAGE_NAME -f backend/Containerfile .

echo -e "${GREEN}✅ Container image built successfully!${NC}"

# Stop and remove existing container if running
if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}🛑 Stopping existing container...${NC}"
    podman stop $CONTAINER_NAME
    podman rm $CONTAINER_NAME
fi

echo -e "${GREEN}🚀 Starting container...${NC}"
echo "Container will be available at: http://localhost:$PORT/api/healthcheck"

# Run the container
podman run -d \
    --name $CONTAINER_NAME \
    -p $PORT:80 \
    -e PORT=80 \
    -e NODE_ENV=development \
    $IMAGE_NAME

# Wait a moment for the container to start
sleep 3

# Check if container is running
if podman ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}✅ Container started successfully!${NC}"
    echo -e "${GREEN}📊 Container Status:${NC}"
    podman ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo -e "\n${GREEN}🔍 Testing health endpoint...${NC}"
    sleep 5  # Give the app time to fully start
    
    if curl -f http://localhost:$PORT/api/healthcheck > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed!${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check not ready yet. Try: curl http://localhost:$PORT/api/healthcheck${NC}"
    fi
    
    echo -e "\n${GREEN}📋 Useful commands:${NC}"
    echo "  View logs:     podman logs -f $CONTAINER_NAME"
    echo "  Stop container: podman stop $CONTAINER_NAME"
    echo "  Remove container: podman rm $CONTAINER_NAME"
    echo "  Health check:  curl http://localhost:$PORT/api/healthcheck"
    echo "  Shell access:  podman exec -it $CONTAINER_NAME sh"
else
    echo -e "${RED}❌ Container failed to start${NC}"
    echo -e "${RED}Logs:${NC}"
    podman logs $CONTAINER_NAME
    exit 1
fi
