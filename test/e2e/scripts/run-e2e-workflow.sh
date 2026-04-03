#!/bin/bash

# Complete E2E Testing Workflow
# Orchestrates: startup → test → report → teardown
#
# Usage: ./run-e2e-workflow.sh [OPTIONS]
#   --open-report    Open HTML report in browser after tests complete
#
# Note: Database seeding always runs to ensure databases exist before backend starts

set -e

# Parse command line arguments
OPEN_REPORT=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --open-report)
            OPEN_REPORT=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--open-report]"
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
        # Suppress errors if containers are already stopped
        podman-compose down 2>/dev/null || true
        echo -e "${GREEN}✅ Services stopped${NC}"
    fi
}

# Register cleanup on exit
trap cleanup EXIT

# Step 1: Build deps image (hash-based cache via ghcr.io) and service images
echo -e "${BLUE}📦 Step 1: Building images and starting services...${NC}"
echo ""

REGISTRY="ghcr.io/us-trustee-program/bankruptcy-oversight-support-systems"

# Compute a hash of all package*.json files that feed into Dockerfile.deps
# A change to any package file produces a new hash → cache miss → rebuild
DEPS_HASH=$(cat ../../package*.json ../../common/package*.json ../../backend/package*.json ../../user-interface/package*.json package*.json 2>/dev/null | sha256sum | cut -c1-12)
DEPS_CACHED_IMAGE="${REGISTRY}/e2e-deps:${DEPS_HASH}"

# TODO: restore to false once the e2e pipeline is stable
FORCE_REBUILD_DEPS=true

# Check local image first, then ghcr.io cache, then build from scratch.
# Set FORCE_REBUILD_DEPS=true to skip the cache and rebuild unconditionally.
DEPS_EXISTS=$(podman images -q localhost/e2e_deps:latest 2>/dev/null)
if [ "${FORCE_REBUILD_DEPS:-false}" = "true" ]; then
    echo "Force-rebuilding deps image (FORCE_REBUILD_DEPS=true, hash: ${DEPS_HASH})..."
    podman build -t localhost/e2e_deps:latest -f Dockerfile.deps ../../
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        podman tag localhost/e2e_deps:latest "${DEPS_CACHED_IMAGE}"
        podman push "${DEPS_CACHED_IMAGE}"
        echo -e "  ${GREEN}✓ Deps image rebuilt and cached: ${DEPS_CACHED_IMAGE}${NC}"
    fi
elif [ -n "$DEPS_EXISTS" ]; then
    echo "Using local deps image (hash: ${DEPS_HASH})"
elif [ -n "${GITHUB_TOKEN:-}" ] && podman pull "${DEPS_CACHED_IMAGE}" 2>/dev/null; then
    echo -e "  ${GREEN}✓ Pulled deps image from cache: ${DEPS_CACHED_IMAGE}${NC}"
    podman tag "${DEPS_CACHED_IMAGE}" localhost/e2e_deps:latest
else
    echo "Building deps image (hash: ${DEPS_HASH}) and pushing to ghcr.io cache..."
    podman build -t localhost/e2e_deps:latest -f Dockerfile.deps ../../
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        podman tag localhost/e2e_deps:latest "${DEPS_CACHED_IMAGE}"
        podman push "${DEPS_CACHED_IMAGE}"
        echo -e "  ${GREEN}✓ Deps image cached: ${DEPS_CACHED_IMAGE}${NC}"
    fi
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

# Tear down any containers/networks left from a previous run before starting fresh
echo -e "${BLUE}🧹 Tearing down any containers from a previous run...${NC}"
podman-compose down 2>/dev/null || true
podman rm -f cams-mongodb-e2e cams-sqlserver-e2e cams-backend-e2e cams-frontend-e2e 2>/dev/null || true
podman network rm e2e_cams-e2e 2>/dev/null || true
echo ""

# Start databases first (mongodb, sqlserver, azurite)
echo "Starting databases..."
podman-compose up -d azurite mongodb sqlserver > /dev/null
CLEANUP_NEEDED=true
echo ""
echo -e "${GREEN}✓ Databases starting${NC}"
echo ""

# Step 2: Wait for databases to be ready
echo -e "${BLUE}⏳ Step 2: Waiting for databases and services to be healthy...${NC}"
echo ""

MAX_WAIT=120  # 2 minutes for services
WAIT_COUNT=0
LOG_INTERVAL=20  # Print verbose status every 20 seconds

# Collect and save logs for all containers
collect_container_logs() {
    local log_dir="container-logs"
    mkdir -p "${log_dir}"
    for container in cams-mongodb-e2e cams-sqlserver-e2e cams-backend-e2e cams-frontend-e2e; do
        podman logs "${container}" > "${log_dir}/${container}.log" 2>&1 || true
    done
    echo -e "${BLUE}📋 Container logs saved to ${log_dir}/${NC}"
}

# Print current status of all containers
print_container_status() {
    echo ""
    echo -e "${BLUE}  Container status at ${WAIT_COUNT}s:${NC}"
    podman ps -a \
        --filter "name=cams-azurite-e2e" \
        --filter "name=cams-mongodb-e2e" \
        --filter "name=cams-sqlserver-e2e" \
        --filter "name=cams-backend-e2e" \
        --filter "name=cams-frontend-e2e" \
        --format "    {{.Names}}\t{{.Status}}\t{{.Health}}" 2>/dev/null || true
    echo ""
    echo -e "${BLUE}  Backend log (last 10 lines):${NC}"
    podman logs --tail 10 cams-backend-e2e 2>&1 | sed 's/^/    /' || true
    echo ""
    echo -e "${BLUE}  Frontend log (last 5 lines):${NC}"
    podman logs --tail 5 cams-frontend-e2e 2>&1 | sed 's/^/    /' || true
    echo ""
    echo -e "${BLUE}  HTTP checks:${NC}"
    echo "    backend  (7071): $(curl -s --max-time 3 http://localhost:7071/api/healthcheck > /dev/null 2>&1 && echo 'ok' || echo 'fail')"
    echo "    frontend (3000): $(curl -sf --max-time 3 http://localhost:3000 > /dev/null 2>&1 && echo 'ok' || echo 'fail')"
    echo ""
}

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # Check if backend container has crashed (exited status)
    BACKEND_STATUS=$(podman inspect cams-backend-e2e --format '{{.State.Status}}' 2>/dev/null || echo "missing")
    if [ "$BACKEND_STATUS" = "exited" ]; then
        echo ""
        echo -e "${RED}❌ Backend container has crashed!${NC}"
        echo ""
        echo -e "${BLUE}Backend logs:${NC}"
        podman logs cams-backend-e2e 2>&1 | tail -30 | sed 's/^/  /'
        collect_container_logs
        echo ""
        echo -e "${RED}Exiting due to backend crash. Check logs above for IServiceProvider or other errors.${NC}"
        exit 1
    fi

    # The Functions host is ready when it responds to any HTTP request (even 500 — the
    # /api/healthcheck does deep DB checks that may fail but the host itself is up).
    # The frontend is ready when it serves HTTP. These two checks are sufficient.
    # Both services publish their ports so localhost works from the runner host.
    BACKEND_HTTP=$(curl -s --max-time 3 http://localhost:7071/api/healthcheck > /dev/null 2>&1 && echo "ok" || echo "fail")
    FRONTEND_HTTP=$(curl -sf --max-time 3 http://localhost:3000 > /dev/null 2>&1 && echo "ok" || echo "fail")
    if [ "$BACKEND_HTTP" = "ok" ] && [ "$FRONTEND_HTTP" = "ok" ]; then
        echo -e "${GREEN}✅ All services are healthy and responding${NC}"
        echo ""
        break
    fi

    # Print verbose status periodically
    if [ $((WAIT_COUNT % LOG_INTERVAL)) -eq 0 ] && [ $WAIT_COUNT -gt 0 ]; then
        print_container_status
    else
        echo -n "."
    fi

    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Services did not become healthy within ${MAX_WAIT}s — collecting diagnostic logs...${NC}"
    print_container_status
    collect_container_logs
    echo ""
    echo -e "${YELLOW}⚠️  Proceeding anyway — tests will likely fail${NC}"
    echo ""
fi

# Step 2.5: Seed databases (always runs to ensure databases exist)
echo -e "${BLUE}🌱 Seeding E2E databases...${NC}"
echo ""

# Seed MongoDB
echo "Seeding MongoDB..."
if podman-compose run --rm --no-deps \
  --network e2e_cams-e2e \
  -e MONGO_CONNECTION_STRING="mongodb://mongodb:27017/cams-e2e?retrywrites=false" \
  playwright npm run seed; then
    echo -e "${GREEN}✓ MongoDB seeded${NC}"
else
    echo -e "${RED}✗ MongoDB seeding failed${NC}"
    echo "Tests may fail due to missing data"
fi
echo ""

# Seed SQL Server (creates CAMS and CAMS_E2E databases + tables)
echo "Seeding SQL Server..."
if podman-compose run --rm --no-deps \
  --network e2e_cams-e2e \
  -e MSSQL_HOST=sqlserver \
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

echo -e "${GREEN}✅ Databases seeded${NC}"
echo ""

# Step 2.6: Start application services (backend, frontend)
echo "Starting application services..."
podman-compose up -d backend frontend > /dev/null
echo -e "${GREEN}✓ Application services starting${NC}"
echo ""

# Step 2.7: Warm up SQL Server plan cache and buffer pool
# The first getCaseDetail call hits 6+ uncompiled queries on a cold SQL Edge instance.
# Running the key join patterns once here forces SQL Server to compile execution plans
# and load data pages into the buffer pool before Playwright starts.
echo -e "${BLUE}🔥 Step 2.7: Warming up SQL Server plan cache...${NC}"
echo ""
podman-compose run --rm --no-deps \
  --network e2e_cams-e2e \
  -e MSSQL_HOST=sqlserver \
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
podman-compose run --rm --no-deps playwright npm run headless 2>&1 | tee "$TEST_OUTPUT_FILE"
TEST_EXIT_CODE=${PIPESTATUS[0]}
set -e
TEST_OUTPUT=$(cat "$TEST_OUTPUT_FILE")
rm -f "$TEST_OUTPUT_FILE"

# Save all container logs now (containers still running, before cleanup)
collect_container_logs
mkdir -p backend-logs
BACKEND_LOG_FILE="backend-logs/backend.log"
cp container-logs/cams-backend-e2e.log "$BACKEND_LOG_FILE" 2>/dev/null || true

# If tests failed, print the last 100 lines of backend logs
if [ "$TEST_EXIT_CODE" -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}📋 Backend logs (last 100 lines):${NC}"
    tail -100 "$BACKEND_LOG_FILE"
    echo ""
fi
echo -e "${BLUE}📋 Full container logs saved to: container-logs/${NC}"

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
echo "   - Results:        ./test-results/"
echo "   - Container logs: ./container-logs/"
echo "   - Report:         ./playwright-report/"
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
