#! /bin/bash

if [[ $OUT == "" ]]; then
  FILE_NAME=$1;
else
  FILE_NAME=$OUT;
fi

PACK_TEMP_DIR="/tmp/build/$1"

echo "Creating archive $PACK_TEMP_DIR/$FILE_NAME.zip"

# Detect OS and build node_modules accordingly
# NOTE: This script is called from backend/function-apps/<app> directory
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Running on Linux (GitHub Actions CI) - build dependencies directly
  # We're already in backend/function-apps/<app>, just install here
  # Use npm ci for reproducible, lockfile-driven installs
  # Use --workspaces=false to disable workspace linking and force local node_modules
  # NOTE: Flags must match Dockerfile.build for consistency
  echo "Building dependencies on Linux (native)..."
  npm ci --production --ignore-scripts=false --workspaces=false
elif [[ "$OSTYPE" == "darwin"* ]]; then
  # Running on macOS - use Podman/Docker to build for Linux
  echo "Building dependencies for Linux using Podman..."
  # Go to workspace root to access package-lock.json
  cd ../../.. || exit
  podman build -t "cams-$1-builder:latest" -f backend/Dockerfile.build --build-arg "FUNCTION_APP=$1" .
  CONTAINER_ID=$(podman create "cams-$1-builder:latest")
  podman cp "$CONTAINER_ID:/build/node_modules" "backend/function-apps/$1/"
  podman rm "$CONTAINER_ID"
  # Return to function app directory
  cd "backend/function-apps/$1" || exit
else
  echo "Error: Unsupported OS type: $OSTYPE"
  exit 1
fi

# Create the zip archive with Linux-built node_modules
mkdir -p "$PACK_TEMP_DIR"
zip -q -r "$PACK_TEMP_DIR/$FILE_NAME.zip" ./dist ./node_modules ./package.json ./host.json --exclude "*.map" --exclude "*.ts"
mv "$PACK_TEMP_DIR/$FILE_NAME.zip" .

# Clean up node_modules
rm -rf node_modules
