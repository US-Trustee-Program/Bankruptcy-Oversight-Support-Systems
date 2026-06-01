#!/bin/bash
set -e

# Install Podman and Podman Compose for E2E Testing
# This script checks if podman and podman-compose are installed
# and installs them via Homebrew if needed

echo "🔍 Checking Podman dependencies..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track what needs to be installed
NEEDS_PODMAN=false
NEEDS_PODMAN_COMPOSE=false
NEEDS_PODMAN_INIT=false

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo -e "${RED}❌ Error: Homebrew is not installed${NC}"
    echo ""
    echo "Homebrew is required to install Podman and Podman Compose."
    echo "Please install Homebrew first:"
    echo ""
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo ""
    echo "Visit https://brew.sh for more information."
    exit 1
fi

echo -e "${GREEN}✅ Homebrew is installed${NC}"

# Check if podman is installed
if ! command -v podman &> /dev/null; then
    echo -e "${YELLOW}⚠️  Podman is not installed${NC}"
    NEEDS_PODMAN=true
else
    PODMAN_VERSION=$(podman --version | awk '{print $3}')
    echo -e "${GREEN}✅ Podman is installed (version ${PODMAN_VERSION})${NC}"

    # Check if podman machine is initialized
    if ! podman machine list 2>/dev/null | grep -q "Currently running"; then
        echo -e "${YELLOW}⚠️  Podman machine is not initialized or running${NC}"
        NEEDS_PODMAN_INIT=true
    else
        echo -e "${GREEN}✅ Podman machine is running${NC}"
    fi
fi

# Check if podman-compose is installed
if ! command -v podman-compose &> /dev/null; then
    echo -e "${YELLOW}⚠️  Podman Compose is not installed${NC}"
    NEEDS_PODMAN_COMPOSE=true
else
    COMPOSE_VERSION=$(podman-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    echo -e "${GREEN}✅ Podman Compose is installed (version ${COMPOSE_VERSION})${NC}"
fi

echo ""

# If everything is installed and initialized, we're done
if [ "$NEEDS_PODMAN" = false ] && [ "$NEEDS_PODMAN_COMPOSE" = false ] && [ "$NEEDS_PODMAN_INIT" = false ]; then
    echo -e "${GREEN}🎉 All dependencies are installed and ready!${NC}"
    echo ""
    echo "You can now run E2E tests with:"
    echo "  npm run podman:test"
    exit 0
fi

# Install missing dependencies
echo "📦 Installing missing dependencies..."
echo ""

if [ "$NEEDS_PODMAN" = true ]; then
    echo "Installing Podman via Homebrew..."
    brew install podman
    echo -e "${GREEN}✅ Podman installed${NC}"
    echo ""
    NEEDS_PODMAN_INIT=true
fi

if [ "$NEEDS_PODMAN_COMPOSE" = true ]; then
    echo "Installing Podman Compose via Homebrew..."
    brew install podman-compose
    echo -e "${GREEN}✅ Podman Compose installed${NC}"
    echo ""
fi

# Minimum memory required to run the full E2E container stack:
# SQL Edge (~2GB) + MongoDB + Azurite + backend + frontend
REQUIRED_MEMORY_MB=6144
REQUIRED_CPUS=4

# Initialize podman machine if needed
if [ "$NEEDS_PODMAN_INIT" = true ]; then
    echo "🚀 Initializing Podman machine..."
    echo ""

    # Check if a machine already exists but isn't running
    if podman machine list 2>/dev/null | grep -q "podman-machine-default"; then
        # Ensure the machine has enough resources before starting
        CURRENT_MEMORY=$(podman machine inspect podman-machine-default 2>/dev/null | jq -r '.[0].Resources.Memory // 0')
        CURRENT_CPUS=$(podman machine inspect podman-machine-default 2>/dev/null | jq -r '.[0].Resources.CPUs // 0')
        NEEDS_RESIZE=false
        if [ "${CURRENT_MEMORY}" -lt "${REQUIRED_MEMORY_MB}" ]; then
            echo "Memory below minimum (${CURRENT_MEMORY}MB < ${REQUIRED_MEMORY_MB}MB), resizing..."
            NEEDS_RESIZE=true
        fi
        if [ "${CURRENT_CPUS}" -lt "${REQUIRED_CPUS}" ]; then
            echo "CPUs below minimum (${CURRENT_CPUS} < ${REQUIRED_CPUS}), resizing..."
            NEEDS_RESIZE=true
        fi
        if [ "${NEEDS_RESIZE}" = true ]; then
            podman machine set --memory "${REQUIRED_MEMORY_MB}" --cpus "${REQUIRED_CPUS}" podman-machine-default
        fi
        echo "Starting existing Podman machine..."
        podman machine start
    else
        echo "Creating and starting new Podman machine (${REQUIRED_MEMORY_MB}MB RAM, ${REQUIRED_CPUS} CPUs)..."
        podman machine init --memory "${REQUIRED_MEMORY_MB}" --cpus "${REQUIRED_CPUS}"
        podman machine start
    fi

    echo -e "${GREEN}✅ Podman machine initialized and started${NC}"
    echo ""
fi

# Verify installation
echo "🔍 Verifying installation..."
echo ""

PODMAN_VERSION=$(podman --version | awk '{print $3}')
COMPOSE_VERSION=$(podman-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

echo -e "${GREEN}✅ Podman version: ${PODMAN_VERSION}${NC}"
echo -e "${GREEN}✅ Podman Compose version: ${COMPOSE_VERSION}${NC}"

# Check machine status
if podman machine list 2>/dev/null | grep -q "Currently running"; then
    echo -e "${GREEN}✅ Podman machine is running${NC}"
else
    echo -e "${YELLOW}⚠️  Podman machine is not running (this may be normal)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""
echo "You can now run E2E tests with:"
echo "  cd test/e2e"
echo "  npm run podman:test"
echo ""
echo "Other available commands:"
echo "  npm run podman:services  - Start backend and frontend"
echo "  npm run podman:status    - Check service status"
echo "  npm run podman:clean     - Clean up containers"
echo ""
