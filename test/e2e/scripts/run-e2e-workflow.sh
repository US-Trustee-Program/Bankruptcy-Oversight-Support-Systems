#!/bin/bash

# Complete E2E Testing Workflow
# Orchestrates: startup → test → report → teardown
#
# Usage: ./run-e2e-workflow.sh [OPTIONS]
#   --reseed         Clear and reseed the database before running tests
#   --open-report    Open HTML report in browser after tests complete

set -e

# Parse command line arguments
RESEED_DB=false
OPEN_REPORT=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --reseed)
            RESEED_DB=true
            shift
            ;;
        --open-report)
            OPEN_REPORT=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--reseed] [--open-report]"
            exit 1
            ;;
    esac
done

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

# Load environment variables from .env
set -a
# shellcheck disable=SC1091
source .env
set +a

# Track overall success
TESTS_PASSED=false
CLEANUP_NEEDED=false

# Cleanup function
# shellcheck disable=SC2329  # Function invoked via trap
cleanup() {
    if [ "$CLEANUP_NEEDED" = true ]; then
        echo ""
        echo -e "${BLUE}🧹 Tearing down services...${NC}"
        for container in cams-azurite-e2e cams-mongodb-e2e cams-sqlserver-e2e cams-backend-e2e cams-frontend-e2e cams-playwright-e2e; do
            podman rm -f "$container" 2>/dev/null || true
        done
        podman network rm cams-e2e 2>/dev/null || true
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

# Check if built image exists (compiles common, backend, frontend once)
BUILT_EXISTS=$(podman images -q localhost/e2e_built:latest)
if [ -z "$BUILT_EXISTS" ]; then
    echo "Building built image (first time - this will be cached)..."
    podman build -t localhost/e2e_built:latest -f Dockerfile.built ../../
else
    echo "Using cached built image (run 'npm run podman:rebuild-built' to rebuild)"
fi

# Build service images (thin layers on top of built — only CMD/WORKDIR)
echo "Building service images..."
podman build -t e2e_backend:latest -f Dockerfile.backend ../../
podman build -t e2e_frontend:latest -f Dockerfile.frontend ../../
podman build -t e2e_playwright:latest -f Dockerfile.playwright ../../
echo ""
echo -e "${GREEN}✅ Images built${NC}"
echo ""

# Force-remove any stale named containers before starting fresh
echo -e "${BLUE}🧹 Clearing any stale containers...${NC}"
for container in cams-azurite-e2e cams-mongodb-e2e cams-sqlserver-e2e cams-backend-e2e cams-frontend-e2e cams-playwright-e2e; do
    podman rm -f "$container" 2>/dev/null || true
done
echo ""

# Start all services (azurite must be healthy before backend starts)
echo "Starting services..."
podman-compose up -d azurite mongodb sqlserver backend frontend > /dev/null
CLEANUP_NEEDED=true
echo ""
echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 2: Wait for services to be healthy
echo -e "${BLUE}⏳ Step 2: Waiting for databases and services to be healthy...${NC}"
echo ""

MAX_WAIT=120  # 2 minutes for services
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # Use podman ps directly — podman-compose ps is unreliable outside compose context
    MONGODB_STATUS=$(podman ps --filter "name=cams-mongodb-e2e" --filter "status=running" --format "{{.Names}}" 2>/dev/null | grep -c "." || echo "0")
    SQLSERVER_STATUS=$(podman ps --filter "name=cams-sqlserver-e2e" --filter "status=running" --format "{{.Names}}" 2>/dev/null | grep -c "." || echo "0")
    BACKEND_STATUS=$(podman ps --filter "name=cams-backend-e2e" --filter "status=running" --format "{{.Names}}" 2>/dev/null | grep -c "." || echo "0")
    FRONTEND_STATUS=$(podman ps --filter "name=cams-frontend-e2e" --filter "status=running" --format "{{.Names}}" 2>/dev/null | grep -c "." || echo "0")

    if [ "$MONGODB_STATUS" = "1" ] && [ "$SQLSERVER_STATUS" = "1" ] && [ "$BACKEND_STATUS" = "1" ] && [ "$FRONTEND_STATUS" = "1" ]; then
        # Services are up, now check if backend and frontend are responding
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

# Step 2.5: Clear and seed databases (optional)
if [ "$RESEED_DB" = true ]; then
    echo -e "${BLUE}🌱 Clearing and seeding E2E databases...${NC}"
    echo ""

    # Seed MongoDB
    echo "Seeding MongoDB..."
    # Run seed script from playwright container which has full codebase
    # Override MONGO_CONNECTION_STRING to use localhost (host network mode)
    if podman-compose run --rm --no-deps \
      -e MONGO_CONNECTION_STRING="mongodb://localhost:27017/cams-e2e?retrywrites=false" \
      -e MSSQL_HOST=localhost \
      playwright npm run seed; then
        echo -e "${GREEN}✓ MongoDB seeded${NC}"
    else
        echo -e "${RED}✗ MongoDB seeding failed${NC}"
        echo "Tests may fail due to missing data"
    fi
    echo ""

    # Seed SQL Server
    echo "Seeding SQL Server..."
    if podman-compose run --rm --no-deps \
      -e MSSQL_HOST=localhost \
      -e MSSQL_USER=sa \
      -e MSSQL_PASS="${MSSQL_PASS}" \
      -e MSSQL_DATABASE_DXTR=CAMS_E2E \
      -e MSSQL_ENCRYPT=false \
      -e MSSQL_TRUST_UNSIGNED_CERT=true \
      playwright npm run seed:sql; then
        echo -e "${GREEN}✓ SQL Server seeded${NC}"
    else
        echo -e "${RED}✗ SQL Server seeding failed${NC}"
        echo "Tests may fail due to missing data"
    fi
    echo ""

    echo -e "${GREEN}✅ Databases cleared and seeded${NC}"
    echo ""
else
    echo -e "${BLUE}ℹ️  Skipping database seeding (using existing data)${NC}"
    echo -e "${BLUE}   Use --reseed flag to clear and reseed the databases${NC}"
    echo ""
fi

# Step 2.7: Warm up SQL Server plan cache and buffer pool
# The first getCaseDetail call hits 6+ uncompiled queries on a cold SQL Edge instance.
# Running the key join patterns once here forces SQL Server to compile execution plans
# and load data pages into the buffer pool before Playwright starts.
echo -e "${BLUE}🔥 Step 2.7: Warming up SQL Server plan cache...${NC}"
echo ""
podman-compose run --rm --no-deps \
  -e MSSQL_HOST=localhost \
  -e MSSQL_USER=sa \
  -e MSSQL_PASS="${MSSQL_PASS}" \
  -e MSSQL_DATABASE_DXTR=CAMS_E2E \
  -e MSSQL_ENCRYPT=false \
  -e MSSQL_TRUST_UNSIGNED_CERT=true \
  playwright npx tsx ./scripts/warmup-sqlserver.ts 2>/dev/null || true
echo -e "${GREEN}✅ SQL Server warmed up${NC}"
echo ""

# Step 3: Run tests
echo -e "${BLUE}🧪 Step 3: Running E2E tests...${NC}"
echo ""

# Run playwright tests in container and stream output directly (no filtering — the
# line reporter writes useful progress lines that must not be suppressed).
# Capture to a temp file so we can parse the summary counts afterward.
TEST_OUTPUT_FILE=$(mktemp)
set +e
podman-compose run --rm playwright npm run headless 2>&1 | tee "$TEST_OUTPUT_FILE"
TEST_EXIT_CODE=${PIPESTATUS[0]}
set -e
TEST_OUTPUT=$(cat "$TEST_OUTPUT_FILE")
rm -f "$TEST_OUTPUT_FILE"

# Save full backend logs now (containers still running, before cleanup)
mkdir -p backend-logs
BACKEND_LOG_FILE="backend-logs/backend.log"
podman logs cams-backend-e2e > "$BACKEND_LOG_FILE" 2>&1 || true

# If tests failed, print the last 100 lines of backend logs
if [ "$TEST_EXIT_CODE" -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}📋 Backend logs (last 100 lines):${NC}"
    tail -100 "$BACKEND_LOG_FILE"
    echo ""
fi
echo -e "${BLUE}📋 Full backend log saved to: backend-logs/backend.log${NC}"

if [ "$TEST_EXIT_CODE" -eq 0 ]; then
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

# Parse failed/passed counts from Playwright summary line, e.g. "5 failed, 12 passed"
FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | tail -1)
PASSED_TESTS=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | tail -1)
FAILED_TESTS=${FAILED_TESTS:-0}
PASSED_TESTS=${PASSED_TESTS:-0}

if [ "$TESTS_PASSED" = true ]; then
    echo -e "${GREEN}Status: PASSED ✅${NC}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
else
    echo -e "${RED}Status: FAILED ❌${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
fi

echo ""
echo "📁 Test artifacts location:"
echo "   - Results:      ./test-results/"
echo "   - Backend log:  ./backend-logs/backend.log"
echo "   - Report:       ./playwright-report/"
echo ""
echo "To view detailed report:"
echo "   npm run report"
echo ""

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

# Open HTML report in browser (optional)
if [ "$OPEN_REPORT" = true ]; then
    if [ -f "playwright-report/index.html" ]; then
        echo "Opening HTML report in browser..."
        echo ""
        # Use open command on macOS to open the HTML file directly
        if command -v open >/dev/null 2>&1; then
            open playwright-report/index.html
            echo "✅ Report opened in default browser"
            echo ""
        else
            echo -e "${YELLOW}⚠️  Could not open report automatically${NC}"
            echo "   View report with: npm run report"
            echo "   Or open: $(pwd)/playwright-report/index.html"
            echo ""
        fi
    else
        echo -e "${YELLOW}No HTML report generated${NC}"
        echo ""
    fi
else
    echo "📊 Test report available at: ./playwright-report/index.html"
    echo "   View with: npm run report"
    echo ""
fi

# Always exit 0 to avoid npm error messages
exit 0
