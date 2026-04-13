#!/bin/bash

# Complete E2E Testing Workflow
# Orchestrates: build → start → wait → test → report → teardown
#
# Architecture:
#   cams-e2e-pod  (Podman pod — shared localhost network namespace)
#     ├── sqledge   mcr.microsoft.com/azure-sql-edge:latest
#     ├── mongodb   mongo:7.0
#     ├── azurite   mcr.microsoft.com/azure-storage/azurite:latest
#     └── backend   e2e_backend:latest (Functions host, seeds DBs on startup)
#   frontend        e2e_frontend:latest (port 3000, standalone)
#   playwright      e2e_playwright:latest (test runner, standalone)
#
# Usage: ./run-e2e-workflow.sh [--open-report]

set -e

OPEN_REPORT=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --open-report) OPEN_REPORT=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

export DOTENV_CONFIG_SILENT=true
export DOTENV_QUIET=true

echo "🚀 Starting Complete E2E Testing Workflow"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found in test/e2e/${NC}"
    exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

POD_NAME="cams-e2e-pod"
TESTS_PASSED=false
CLEANUP_NEEDED=false

collect_container_logs() {
    local log_dir="container-logs"
    mkdir -p "${log_dir}"
    for container in cams-sqledge-e2e cams-mongodb-e2e cams-azurite-e2e cams-backend-e2e cams-frontend-e2e; do
        podman logs "${container}" > "${log_dir}/${container}.log" 2>&1 || true
    done
    echo -e "${BLUE}📋 Container logs saved to ${log_dir}/${NC}"
}

cleanup() {
    if [ "$CLEANUP_NEEDED" = true ]; then
        echo ""
        collect_container_logs
        echo -e "${BLUE}🧹 Tearing down services...${NC}"
        podman pod stop "${POD_NAME}" 2>/dev/null || true
        podman pod rm -f "${POD_NAME}" 2>/dev/null || true
        podman rm -f cams-frontend-e2e cams-playwright-e2e 2>/dev/null || true
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

# Cached base images in GHCR — multi-arch (amd64 + arm64)
# Refresh with: npm run podman:cache-images
GHCR_SQLEDGE="${REGISTRY}/e2e-base-azure-sql-edge-latest"
GHCR_MONGODB="${REGISTRY}/e2e-base-mongo-7.0"
GHCR_AZURITE="${REGISTRY}/e2e-base-azure-storage-azurite-latest"

# Use GHCR cached images if available (CI has GITHUB_TOKEN), otherwise fall back to upstream
resolve_image() {
    local ghcr_image="$1" upstream="$2"
    if podman image exists "${ghcr_image}" 2>/dev/null || \
       ([ -n "${GITHUB_TOKEN:-}" ] && podman pull "${ghcr_image}" >/dev/null 2>&1); then
        echo "${ghcr_image}"
    else
        echo "${upstream}"
    fi
}

IMAGE_SQLEDGE=$(resolve_image "${GHCR_SQLEDGE}" "mcr.microsoft.com/azure-sql-edge:latest")
IMAGE_MONGODB=$(resolve_image "${GHCR_MONGODB}" "mongo:7.0")
IMAGE_AZURITE=$(resolve_image "${GHCR_AZURITE}" "mcr.microsoft.com/azure-storage/azurite:latest")

echo "  SQL Edge: ${IMAGE_SQLEDGE}"
echo "  MongoDB:  ${IMAGE_MONGODB}"
echo "  Azurite:  ${IMAGE_AZURITE}"
echo ""

DEPS_HASH=$(cat ../../package*.json ../../common/package*.json ../../backend/package*.json ../../user-interface/package*.json package*.json 2>/dev/null | sha256sum | cut -c1-12)
DEPS_CACHED_IMAGE="${REGISTRY}/e2e-deps:${DEPS_HASH}"

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

BUILT_EXISTS=$(podman images -q localhost/e2e_built:latest)
if [ -z "$BUILT_EXISTS" ]; then
    echo "Building compiled image (first time)..."
    podman build -t localhost/e2e_built:latest -f Dockerfile.built ../../
else
    echo "Using cached built image (run 'npm run podman:rebuild-built' to rebuild)"
fi

echo "Building service images..."
podman build -t e2e_backend:latest -f Dockerfile.backend ../../
podman build -t e2e_frontend:latest -f Dockerfile.frontend ../../
podman build -t e2e_playwright:latest -f Dockerfile.playwright ../../
echo ""
echo -e "${GREEN}✅ Images built${NC}"
echo ""

# ──────────────────────────────────────────────────────
# Step 2: Start services
# ──────────────────────────────────────────────────────
echo -e "${BLUE}🧹 Cleaning up previous run...${NC}"
podman pod stop "${POD_NAME}" 2>/dev/null || true
podman pod rm -f "${POD_NAME}" 2>/dev/null || true
podman rm -f cams-frontend-e2e cams-playwright-e2e >/dev/null 2>&1 || true
rm -rf container-logs/*.log test-results/* playwright-report/*
echo ""

echo -e "${BLUE}⏳ Step 2: Starting pod and services...${NC}"

# Create the pod — publishes the ports that need host access
podman pod create \
    --name "${POD_NAME}" \
    --publish 7071:7071 \
    --publish 1433:1433 \
    --publish 27017:27017 \
    --publish 10000:10000 \
    --publish 10001:10001 \
    --publish 10002:10002

# Start SQL Edge in the pod (from GHCR cache)
podman run -d \
    --pod "${POD_NAME}" \
    --name cams-sqledge-e2e \
    -e ACCEPT_EULA=Y \
    -e MSSQL_SA_PASSWORD="${MSSQL_PASS}" \
    -e MSSQL_PID=Developer \
    "${IMAGE_SQLEDGE}"

# Start MongoDB in the pod (from GHCR cache)
podman run -d \
    --pod "${POD_NAME}" \
    --name cams-mongodb-e2e \
    "${IMAGE_MONGODB}" --bind_ip_all

# Start Azurite in the pod (from GHCR cache)
podman run -d \
    --pod "${POD_NAME}" \
    --name cams-azurite-e2e \
    "${IMAGE_AZURITE}" \
    azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 --location /data

# Start backend in the pod (waits for DBs, seeds, starts Functions host)
podman run -d \
    --pod "${POD_NAME}" \
    --name cams-backend-e2e \
    -e NODE_ENV=development \
    -e DOTENV_CONFIG_SILENT=true \
    -e COSMOS_DATABASE_NAME="${COSMOS_DATABASE_NAME}" \
    -e MONGO_CONNECTION_STRING="mongodb://localhost:27017/cams-e2e?retrywrites=false" \
    -e DATABASE_MOCK="${DATABASE_MOCK}" \
    -e MSSQL_HOST=localhost \
    -e MSSQL_DATABASE="${MSSQL_DATABASE:-}" \
    -e MSSQL_DATABASE_DXTR="${MSSQL_DATABASE_DXTR}" \
    -e MSSQL_USER="${MSSQL_USER}" \
    -e MSSQL_PASS="${MSSQL_PASS}" \
    -e MSSQL_ENCRYPT="${MSSQL_ENCRYPT}" \
    -e MSSQL_TRUST_UNSIGNED_CERT="${MSSQL_TRUST_UNSIGNED_CERT}" \
    -e MSSQL_REQUEST_TIMEOUT="${MSSQL_REQUEST_TIMEOUT:-60000}" \
    -e SLOT_NAME="${SLOT_NAME}" \
    e2e_backend:latest

CLEANUP_NEEDED=true
echo ""

# Verify backend container started
if ! podman ps --filter name=cams-backend-e2e --format "{{.Names}}" | grep -q cams-backend-e2e; then
    echo -e "${RED}❌ Backend container failed to start${NC}"
    podman logs cams-backend-e2e 2>&1 | tail -30
    exit 1
fi

# Wait for backend healthcheck
echo "Waiting for backend (databases + seeding + Functions host)..."
APP_WAIT_COUNT=0
APP_MAX_WAIT=180

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
    podman logs --tail 50 cams-backend-e2e 2>&1 | sed 's/^/  /'
    exit 1
fi
echo ""

# Start frontend (standalone — not in pod, port 3000)
echo "Starting frontend..."
podman run -d \
    --name cams-frontend-e2e \
    --publish 3000:3000 \
    -e BROWSER=none \
    -e DOTENV_CONFIG_SILENT=true \
    -e CAMS_PA11Y=false \
    -e CAMS_FEATURE_FLAGS_MODE=test \
    -e CAMS_LOGIN_PROVIDER="${CAMS_LOGIN_PROVIDER}" \
    -e CAMS_LOGIN_PROVIDER_CONFIG="${CAMS_LOGIN_PROVIDER_CONFIG}" \
    -e CAMS_SERVER_HOSTNAME="${CAMS_SERVER_HOSTNAME}" \
    -e CAMS_SERVER_PORT="${CAMS_SERVER_PORT}" \
    -e CAMS_SERVER_PROTOCOL="${CAMS_SERVER_PROTOCOL}" \
    -e CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING= \
    -e SLOT_NAME="${SLOT_NAME}" \
    e2e_frontend:latest

echo "Waiting for frontend..."
for i in $(seq 1 60); do
    if curl -s --max-time 3 http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend healthy${NC}"
        break
    fi
    [ "$i" -eq 60 ] && echo -e "${RED}❌ Frontend failed to start${NC}" && podman logs --tail 20 cams-frontend-e2e 2>&1 && exit 1
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

mkdir -p test-results playwright-report
TEST_OUTPUT_FILE=$(mktemp)
set +e
podman run --rm \
    --name cams-playwright-e2e \
    --network host \
    -e DOTENV_CONFIG_SILENT=true \
    -e TARGET_HOST=http://localhost:3000 \
    -e CAMS_LOGIN_PROVIDER="${CAMS_LOGIN_PROVIDER}" \
    -e OKTA_USER_NAME="${OKTA_USER_NAME}" \
    -e OKTA_PASSWORD="${OKTA_PASSWORD}" \
    -v "$(pwd)/test-results:/app/test/e2e/test-results" \
    -v "$(pwd)/playwright-report:/app/test/e2e/playwright-report" \
    e2e_playwright:latest npm run headless 2>&1 | tee "$TEST_OUTPUT_FILE"
TEST_EXIT_CODE=${PIPESTATUS[0]}
set -e
TEST_OUTPUT=$(cat "$TEST_OUTPUT_FILE")
rm -f "$TEST_OUTPUT_FILE"

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
    command -v open >/dev/null 2>&1 && open playwright-report/index.html
fi

[ "$TESTS_PASSED" = true ] && exit 0 || exit 1
