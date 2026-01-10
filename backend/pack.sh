#! /bin/bash

if [[ $OUT == "" ]]; then
  FILE_NAME=$1;
else
  FILE_NAME=$OUT;
fi

PACK_TEMP_DIR="/tmp/build/$1"

echo "Creating archive $PACK_TEMP_DIR/$FILE_NAME.zip"

# Detect OS and build node_modules accordingly
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Running on Linux (GitHub Actions CI) - build dependencies directly
  echo "Building dependencies on Linux (native)..."
  cd "../../function-apps/$1" || exit
  npm install --production --ignore-scripts=false
  cd ../..
elif [[ "$OSTYPE" == "darwin"* ]]; then
  # Running on macOS - use Podman/Docker to build for Linux
  echo "Building dependencies for Linux using Podman..."
  cd ../..
  podman build -t "cams-$1-builder:latest" -f Dockerfile.build --build-arg "FUNCTION_APP=$1" .
  CONTAINER_ID=$(podman create "cams-$1-builder:latest")
  podman cp "$CONTAINER_ID:/build/node_modules" "function-apps/$1/"
  podman rm "$CONTAINER_ID"
  cd "function-apps/$1" || exit
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
