#! /bin/bash

# Exit on errors, undefined variables, and pipe failures
set -euo pipefail

# Validate function app name argument is provided
if [[ -z "${1:-}" ]]; then
  echo "Error: Function app name argument is required"
  echo "Usage: pack.sh <app-name>"
  echo "Example: pack.sh api"
  exit 1
fi

if [[ -z "${OUT:-}" ]]; then
  FILE_NAME=$1;
else
  FILE_NAME=$OUT;
fi

# Verify we're in the expected directory structure
# NOTE: This script is called from backend/function-apps/<app> directory
if [[ ! -f "package.json" ]] || [[ ! -d "../../../.git" ]]; then
  echo "Error: pack.sh must be run from backend/function-apps/<app> directory"
  echo "Current directory: $(pwd)"
  exit 1
fi

# Set up path variables to avoid hardcoding throughout script
WORKSPACE_ROOT="../../.."
FUNCTION_APP_PATH="backend/function-apps/$1"
PACK_TEMP_DIR="/tmp/build/$1"

echo "Creating archive $PACK_TEMP_DIR/$FILE_NAME.zip"

# Build the function app's production node_modules.
#
# Azure Function apps are deployed as a zip of the esbuild bundle (dist/) plus a node_modules/
# holding only the dependencies esbuild leaves external (backend/esbuild-shared.mjs). The apps
# are intentionally NOT npm workspaces and have no lockfile of their own (npm workspaces support
# a single root lockfile only).
#
# We produce that node_modules from a normal, workspace-aware root install: every dependency the
# app needs already exists there, correctly resolved at the locked version. build-function-app-
# node-modules.mjs walks the production dependency graph from package-lock.json and copies just
# the app's closure into the app directory, preserving the install layout. This is faithful to
# the lockfile and independent of npm's (unstable) hoisting decisions — unlike the previous
# approach, which ran a standalone `npm ci --workspaces=false` and broke whenever a dependency
# was not hoisted to the top level of the root install.
if [[ "$OSTYPE" == linux* ]]; then
  # Running on Linux (GitHub Actions CI, or any Linux variant) - build dependencies directly.
  echo "Building dependencies on Linux (native)..."

  # cd to workspace root to access package-lock.json and node_modules
  cd "$WORKSPACE_ROOT" || exit

  # Ensure a lockfile-faithful root install exists. In CI this has already run; locally it makes
  # the script self-contained. `npm ci` is reproducible and fails if the lockfile is out of sync.
  if [[ ! -d node_modules ]]; then
    echo "Root node_modules not found; running npm ci..."
    npm ci
  fi

  # Compute the app's production closure and copy it into the function app's node_modules.
  node backend/build-function-app-node-modules.mjs "$1" "$FUNCTION_APP_PATH/node_modules"

  # Fail the pack if the assembled node_modules cannot load every runtime dependency.
  node backend/verify-function-app-node-modules.mjs "$FUNCTION_APP_PATH"

  # Return to the function app directory.
  cd "$FUNCTION_APP_PATH" || exit
elif [[ "$OSTYPE" == "darwin"* ]]; then
  # Running on macOS - use Podman to build inside Linux for parity with the deployment target.
  if ! command -v podman &> /dev/null; then
    echo "Error: Podman is required but not found. Please install it."
    exit 1
  fi

  # Go to workspace root to access the build context
  cd "$WORKSPACE_ROOT" || exit
  podman build -t "cams-$1-builder:latest" -f backend/Dockerfile.build --build-arg "FUNCTION_APP=$1" .
  CONTAINER_ID=$(podman create "cams-$1-builder:latest")
  podman cp "$CONTAINER_ID:/build/output/node_modules" "$FUNCTION_APP_PATH/"
  podman rm "$CONTAINER_ID"
  # Return to function app directory
  cd "$FUNCTION_APP_PATH" || exit
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
