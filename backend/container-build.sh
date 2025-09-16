#!/bin/bash

# Container Build Script for CI/CD
set -e

# Configuration
IMAGE_NAME=${1:-"bankruptcy-api"}
IMAGE_TAG=${2:-"latest"}
REGISTRY_URL=${3:-""}

echo "🐳 Building Container Image..."
echo "Image: $IMAGE_NAME:$IMAGE_TAG"

# Build the container image from project root (to include common directory)
cd .. && podman build -t $IMAGE_NAME:$IMAGE_TAG -f backend/Containerfile .

echo "✅ Container image built successfully!"

# If registry URL is provided, tag and push
if [ ! -z "$REGISTRY_URL" ]; then
    FULL_IMAGE_NAME="$REGISTRY_URL/$IMAGE_NAME:$IMAGE_TAG"
    echo "🏷️  Tagging image as: $FULL_IMAGE_NAME"
    podman tag $IMAGE_NAME:$IMAGE_TAG $FULL_IMAGE_NAME
    
    echo "📤 Pushing to registry..."
    podman push $FULL_IMAGE_NAME
    
    echo "✅ Image pushed to registry successfully!"
    echo "Image URL: $FULL_IMAGE_NAME"
fi

echo "🎉 Build process completed!"
