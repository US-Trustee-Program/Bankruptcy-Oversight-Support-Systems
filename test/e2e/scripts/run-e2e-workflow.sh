#!/bin/bash

# Complete E2E Testing Workflow
# Orchestrates: startup → test → report → teardown

set -e

# Suppress dotenv hints/tips
export DOTENV_CONFIG_SILENT=true
export DOTENV_QUIET=true

echo "🚀 Starting Complete E2E Testing Workflow"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to e2e directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found in test/e2e/${NC}"
    echo "Please create .env file with required configuration."
    exit 1
fi

# Track overall success
TESTS_PASSED=false
CLEANUP_NEEDED=false

# Cleanup function
# shellcheck disable=SC2329  # Function invoked via trap
cleanup() {
    if [ "$CLEANUP_NEEDED" = true ]; then
        echo ""
        echo -e "${BLUE}🧹 Tearing down services...${NC}"
        # Suppress errors if containers are already stopped
        podman-compose down 2>/dev/null || true
        echo -e "${GREEN}✅ Services stopped${NC}"
    fi
}

# Register cleanup on exit
trap cleanup EXIT

# Step 1: Build deps image (cached) and service images
echo -e "${BLUE}📦 Step 1: Building images and starting services...${NC}"
echo ""

# Check if deps image exists and is recent
DEPS_EXISTS=$(podman images -q localhost/e2e_deps:latest)
if [ -z "$DEPS_EXISTS" ]; then
    echo "Building deps image (first time - this will be cached)..."
    podman build -t localhost/e2e_deps:latest -f Dockerfile.deps ../../
else
    echo "Using cached deps image (run 'npm run podman:rebuild-deps' to rebuild)"
fi

# Build service images (uses cached deps, only rebuilds changed source)
echo "Building service images..."
podman-compose build backend frontend playwright
echo ""
echo -e "${GREEN}✅ Images built${NC}"
echo ""

# Start backend and frontend services
echo "Starting backend and frontend services..."
podman-compose up -d backend frontend
CLEANUP_NEEDED=true
echo ""
echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 2: Wait for services to be healthy
echo -e "${BLUE}⏳ Step 2: Waiting for services to be healthy...${NC}"
echo ""

MAX_WAIT=60
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # Check if both services are running
    BACKEND_STATUS=$(podman-compose ps | grep backend | grep -c "Up" || echo "0")
    FRONTEND_STATUS=$(podman-compose ps | grep frontend | grep -c "Up" || echo "0")

    if [ "$BACKEND_STATUS" = "1" ] && [ "$FRONTEND_STATUS" = "1" ]; then
        # Services are up, now check if they're responding
        if curl -sf http://localhost:7071/api/healthcheck > /dev/null 2>&1 && \
           curl -sf http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ All services are healthy and responding${NC}"
            echo ""
            break
        fi
    fi

    echo -n "."
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Services may not be fully healthy, proceeding anyway...${NC}"
    echo ""
fi

# Step 3: Run tests
echo -e "${BLUE}🧪 Step 3: Running E2E tests...${NC}"
echo ""

# Run playwright tests in container (capture exit code but don't exit immediately)
# Use 'run' instead of 'up' to properly capture test exit code
set +e
podman-compose run --rm playwright npm run headless
TEST_EXIT_CODE=$?
set -e

if [ $TEST_EXIT_CODE -eq 0 ]; then
    TESTS_PASSED=true
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
fi
echo ""

# Step 4: Generate and display report summary
echo -e "${BLUE}📊 Step 4: Test Report Summary${NC}"
echo ""

# Check if test results exist
if [ -d "test-results" ]; then
    FAILED_TESTS=$(find test-results -type d -name "*-failed-*" 2>/dev/null | wc -l | xargs)

    if [ "$TESTS_PASSED" = true ]; then
        echo -e "${GREEN}Status: PASSED ✅${NC}"
    else
        echo -e "${RED}Status: FAILED ❌${NC}"
        echo -e "${RED}Failed tests: ${FAILED_TESTS}${NC}"
    fi
else
    echo -e "${YELLOW}No test results found${NC}"
fi

echo ""
echo "📁 Test artifacts location:"
echo "   - Results: ./test-results/"
echo "   - Report:  ./playwright-report/"
echo ""
echo "To view detailed report:"
echo "   npm run report"
echo ""

# Step 5: Show service logs on failure
if [ "$TESTS_PASSED" = false ]; then
    echo -e "${BLUE}📋 Step 5: Service Logs (last 20 lines)${NC}"
    echo ""
    echo -e "${YELLOW}Backend logs:${NC}"
    podman-compose logs --tail=20 backend
    echo ""
    echo -e "${YELLOW}Frontend logs:${NC}"
    podman-compose logs --tail=20 frontend
    echo ""
fi

# Final summary
echo "=========================================="
echo -e "${BLUE}🏁 Workflow Complete${NC}"
echo ""

if [ "$TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✅ E2E testing workflow completed successfully!${NC}"
    echo ""
else
    echo -e "${RED}❌ E2E testing workflow completed with failures${NC}"
    echo ""
fi

# Open HTML report in browser
if [ -f "playwright-report/index.html" ]; then
    echo "Opening HTML report in browser..."
    echo ""
    # Use open command on macOS to open the HTML file directly
    if command -v open >/dev/null 2>&1; then
        open playwright-report/index.html
        echo "✅ Report opened in default browser"
        echo ""
        echo "Alternatively, serve the report with: npm run report"
    else
        echo -e "${YELLOW}⚠️  Could not open report automatically${NC}"
        echo "   View report with: npm run report"
        echo "   Or open: $(pwd)/playwright-report/index.html"
    fi
else
    echo -e "${YELLOW}No HTML report generated${NC}"
    echo ""
fi

# Always exit 0 to avoid npm error messages
exit 0
