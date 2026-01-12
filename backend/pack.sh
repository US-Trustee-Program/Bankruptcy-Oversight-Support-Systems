#! /bin/bash

if [[ $OUT == "" ]]; then
  FILE_NAME=$1;
else
  FILE_NAME=$OUT;
fi

PACK_TEMP_DIR="/tmp/build/$1"

# Verify we're in the expected directory structure
# NOTE: This script is called from backend/function-apps/<app> directory
if [[ ! -f "package.json" ]] || [[ ! -d "../../../.git" ]]; then
  echo "Error: pack.sh must be run from backend/function-apps/<app> directory"
  echo "Current directory: $(pwd)"
  exit 1
fi

echo "Creating archive $PACK_TEMP_DIR/$FILE_NAME.zip"

# Detect OS and build node_modules accordingly
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Running on Linux (GitHub Actions CI) - build dependencies directly
  # Use root package-lock.json to match Dockerfile.build behavior
  # Use npm ci for reproducible, lockfile-driven installs
  # Use --workspaces=false to disable workspace linking and force local node_modules
  # NOTE: Flags must match Dockerfile.build for consistency
  echo "Building dependencies on Linux (native)..."

  # cd to workspace root to access package-lock.json
  cd ../../.. || exit

  # Create temp build directory (mirror Dockerfile.build approach)
  BUILD_TEMP="/tmp/npm-ci-$1"
  rm -rf "$BUILD_TEMP"
  mkdir -p "$BUILD_TEMP"

  # Copy package.json and root package-lock.json (mirror Dockerfile.build)
  cp "backend/function-apps/$1/package.json" "$BUILD_TEMP/"
  cp package-lock.json "$BUILD_TEMP/"

  # Run npm ci in temp directory with root lockfile
  cd "$BUILD_TEMP" || exit
  npm ci --production --ignore-scripts=false --workspaces=false

  # Move node_modules to function app directory
  cd - > /dev/null || exit
  mv "$BUILD_TEMP/node_modules" "backend/function-apps/$1/"

  # Clean up temp directory
  rm -rf "$BUILD_TEMP"

  # Return to function app directory
  cd "backend/function-apps/$1" || exit
elif [[ "$OSTYPE" == "darwin"* ]]; then
  # Running on macOS - use Podman/Docker to build for Linux
  # Detect which container runtime is available
  if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
    echo "Building dependencies for Linux using Podman..."
  elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    echo "Building dependencies for Linux using Docker..."
  else
    echo "Error: Neither podman nor docker found. Please install one."
    exit 1
  fi

  # Go to workspace root to access package-lock.json
  cd ../../.. || exit
  $CONTAINER_CMD build -t "cams-$1-builder:latest" -f backend/Dockerfile.build --build-arg "FUNCTION_APP=$1" .
  CONTAINER_ID=$($CONTAINER_CMD create "cams-$1-builder:latest")
  $CONTAINER_CMD cp "$CONTAINER_ID:/build/node_modules" "backend/function-apps/$1/"
  $CONTAINER_CMD rm "$CONTAINER_ID"
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
