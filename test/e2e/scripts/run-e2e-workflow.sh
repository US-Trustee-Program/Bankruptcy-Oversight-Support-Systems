#!/bin/bash

# Complete E2E Testing Workflow
# Orchestrates: build → start → wait → test → report → teardown
#
# Architecture: 3 containers, all on host network
#   backend:    MongoDB + SQL Edge + Azurite + Azure Functions (all localhost)
#   frontend:   Vite preview server (port 3000)
#   playwright: Chromium test runner
#
# Usage: ./run-e2e-workflow.sh [OPTIONS]
#   --open-report    Open HTML report in browser after tests complete

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

COMPOSE_FILES="-f podman-compose.yml"

# shellcheck disable=SC2086
pcompose() {
    podman-compose $COMPOSE_FILES "$@"
}

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found in test/e2e/${NC}"
    exit 1
fi

# Load environment variables from .env
set -a
# shellcheck disable=SC1091
source .env
set +a

TESTS_PASSED=false
CLEANUP_NEEDED=false

# Collect container logs
collect_container_logs() {
    local log_dir="container-logs"
    mkdir -p "${log_dir}"
    for container in cams-backend-e2e cams-frontend-e2e; do
        podman logs "${container}" > "${log_dir}/${container}.log" 2>&1 || true
    done
    echo -e "${BLUE}📋 Container logs saved to ${log_dir}/${NC}"
}

# Cleanup on exit
# shellcheck disable=SC2329
cleanup() {
    if [ "$CLEANUP_NEEDED" = true ]; then
        echo ""
        collect_container_logs
        echo -e "${BLUE}🧹 Tearing down services...${NC}"
        pcompose down 2>/dev/null || true
        echo -e "${GREEN}✅ Services stopped${NC}"
    fi
}
trap cleanup EXIT

# ──────────────────────────────────────────────────────
# Step 1: Build images
# ──────────────────────────────────────────────────────
echo -e "${BLUE}📦 Step 1: Building images...${NC}"
echo ""

REGISTRY="ghcr.io/us-trustee-program/bankruptcy-oversight-support-systems"
DEPS_HASH=$(cat ../../package*.json ../../common/package*.json ../../backend/package*.json ../../user-interface/package*.json package*.json 2>/dev/null | sha256sum | cut -c1-12)
DEPS_CACHED_IMAGE="${REGISTRY}/e2e-deps:${DEPS_HASH}"

# Build or pull deps image
DEPS_EXISTS=$(podman images -q localhost/e2e_deps:latest 2>/dev/null)
if [ "${FORCE_REBUILD_DEPS:-false}" = "true" ]; then
    echo "Force-rebuilding deps image..."
    podman build -t localhost/e2e_deps:latest -f Dockerfile.deps ../../
elif [ -n "$DEPS_EXISTS" ]; then
    echo "Using local deps image (hash: ${DEPS_HASH})"
elif [ -n "${GITHUB_TOKEN:-}" ] && podman pull "${DEPS_CACHED_IMAGE}" 2>/dev/null; then
    echo -e "  ${GREEN}✓ Pulled deps from cache${NC}"
    podman tag "${DEPS_CACHED_IMAGE}" localhost/e2e_deps:latest
else
    echo "Building deps image..."
    podman build -t localhost/e2e_deps:latest -f Dockerfile.deps ../../
fi

# Build or reuse built image
BUILT_EXISTS=$(podman images -q localhost/e2e_built:latest)
if [ -z "$BUILT_EXISTS" ]; then
    echo "Building compiled image (first time)..."
    podman build -t localhost/e2e_built:latest -f Dockerfile.built ../../
else
    echo "Using cached built image (run 'npm run podman:rebuild-built' to rebuild)"
fi

# Build service images
echo "Building service images..."
podman build -t e2e_backend:latest -f Dockerfile.backend ../../
podman build -t e2e_frontend:latest -f Dockerfile.frontend ../../
podman build -t e2e_playwright:latest -f Dockerfile.playwright ../../
echo ""
echo -e "${GREEN}✅ Images built${NC}"
echo ""

# ──────────────────────────────────────────────────────
# Step 2: Start services and wait for readiness
# ──────────────────────────────────────────────────────

# Clean up previous run
echo -e "${BLUE}🧹 Cleaning up previous run...${NC}"
pcompose down 2>/dev/null || true
podman rm -f cams-backend-e2e cams-frontend-e2e cams-playwright-e2e >/dev/null 2>&1 || true
rm -rf container-logs/*.log test-results/* playwright-report/*
echo ""

# Start backend (includes MongoDB, SQL Edge, Azurite — seeds DBs on startup)
echo -e "${BLUE}⏳ Step 2: Starting backend (databases + API)...${NC}"
pcompose up -d backend
CLEANUP_NEEDED=true
echo ""

# Verify container is running
if ! podman ps --filter name=cams-backend-e2e --format "{{.Names}}" | grep -q cams-backend-e2e; then
    echo -e "${RED}❌ Backend container failed to start${NC}"
    echo ""
    echo -e "${BLUE}Build/start logs:${NC}"
    podman logs cams-backend-e2e 2>&1 | tail -30 || echo "  (no logs available)"
    exit 1
fi

# Wait for backend healthcheck (databases start, seed, then Functions host starts)
echo "Waiting for backend to be ready..."
APP_WAIT_COUNT=0
APP_MAX_WAIT=120

while [ $APP_WAIT_COUNT -lt $APP_MAX_WAIT ]; do
    BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:7071/api/healthcheck 2>/dev/null || echo "000")
    if [ "$BACKEND_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Backend healthy${NC}"
        break
    fi
    echo -n "."
    sleep 2
    APP_WAIT_COUNT=$((APP_WAIT_COUNT + 2))
done

if [ $APP_WAIT_COUNT -ge $APP_MAX_WAIT ]; then
    echo ""
    echo -e "${RED}❌ Backend failed to become healthy within ${APP_MAX_WAIT}s${NC}"
    echo ""
    echo -e "${BLUE}Backend logs (last 50 lines):${NC}"
    podman logs --tail 50 cams-backend-e2e 2>&1 | sed 's/^/  /'
    exit 1
fi
echo ""

# Start frontend
echo "Starting frontend..."
pcompose up -d frontend > /dev/null

# Wait for frontend
echo "Waiting for frontend..."
for i in $(seq 1 60); do
    if curl -s --max-time 3 http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend healthy${NC}"
        break
    fi
    [ "$i" -eq 60 ] && echo -e "${RED}❌ Frontend failed to start within 60s${NC}" && podman logs --tail 20 cams-frontend-e2e 2>&1 && exit 1
    sleep 1
done
echo ""
echo -e "${GREEN}✅ All services ready${NC}"
echo ""

# ──────────────────────────────────────────────────────
# Step 3: Run tests
# ──────────────────────────────────────────────────────
echo -e "${BLUE}🧪 Step 3: Running E2E tests...${NC}"
echo ""

TEST_OUTPUT_FILE=$(mktemp)
set +e
pcompose run --rm --no-deps playwright npm run headless 2>&1 | tee "$TEST_OUTPUT_FILE"
TEST_EXIT_CODE=${PIPESTATUS[0]}
set -e
TEST_OUTPUT=$(cat "$TEST_OUTPUT_FILE")
rm -f "$TEST_OUTPUT_FILE"

# Save logs (containers still running)
collect_container_logs
mkdir -p backend-logs
cp container-logs/cams-backend-e2e.log backend-logs/backend.log 2>/dev/null || true

if [ "$TEST_EXIT_CODE" -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}📋 Backend logs (last 100 lines):${NC}"
    tail -100 backend-logs/backend.log
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

# ──────────────────────────────────────────────────────
# Step 4: Report
# ──────────────────────────────────────────────────────
echo -e "${BLUE}📊 Step 4: Test Report Summary${NC}"
echo ""

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

echo "=========================================="
echo -e "${BLUE}🏁 Workflow Complete${NC}"
echo ""

if [ "$TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✅ E2E testing workflow completed successfully!${NC}"
else
    echo -e "${RED}❌ E2E testing workflow completed with failures${NC}"
fi
echo ""

if [ "$OPEN_REPORT" = true ] && [ -f "playwright-report/index.html" ]; then
    if command -v open >/dev/null 2>&1; then
        open playwright-report/index.html
    fi
fi

[ "$TESTS_PASSED" = true ] && exit 0 || exit 1
