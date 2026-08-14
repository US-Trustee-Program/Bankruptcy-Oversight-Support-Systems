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

# Load .env without bash interpretation so special characters like | in values
# are treated as literals (bash's `source` would interpret | as a pipe operator,
# silently truncating values like CAMS_LOGIN_PROVIDER_CONFIG).
# Strip surrounding single or double quotes from values so that entries like
#   CAMS_LOGIN_PROVIDER_CONFIG='issuer=...|clientId=...'
# export the value without the literal quote characters.
while IFS='=' read -r key value || [[ -n "$key" ]]; do
    [[ -z "${key// }" ]] && continue
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    # Strip surrounding single or double quotes
    value="${value#\'}" ; value="${value%\'}"
    value="${value#\"}" ; value="${value%\"}"
    export "${key}=${value}"
done < .env

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
# Preflight: Verify Podman is running
# ──────────────────────────────────────────────────────
if ! podman info >/dev/null 2>&1; then
    echo -e "${RED}❌ Podman is not running or not reachable.${NC}"
    echo ""
    echo "Run the following to start (or initialize) the Podman machine:"
    echo ""
    echo "  npm run podman:install"
    echo ""
    echo "If the machine already exists but is stopped:"
    echo ""
    echo "  podman machine start"
    echo ""
    exit 1
fi

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

# Check the hash stamped into the local image at build time against the current lockfile hash.
# This catches stale cached images after package-lock.json changes (e.g. a dep version bump).
DEPS_CACHED_HASH=$(podman image inspect localhost/e2e_deps:latest --format '{{index .Labels "e2e.deps.hash"}}' 2>/dev/null || true)
DEPS_EXISTS=$(podman images -q localhost/e2e_deps:latest 2>/dev/null)

build_deps_image() {
    podman build --label "e2e.deps.hash=${DEPS_HASH}" -t localhost/e2e_deps:latest -f Dockerfile.deps ../../
}

if [ "${FORCE_REBUILD_DEPS:-false}" = "true" ]; then
    echo "Force-rebuilding deps image..."
    build_deps_image
elif [ -z "$DEPS_EXISTS" ]; then
    if [ -n "${GITHUB_TOKEN:-}" ] && podman pull "${DEPS_CACHED_IMAGE}" 2>/dev/null; then
        echo -e "  ${GREEN}✓ Pulled deps from cache${NC}"
        podman tag "${DEPS_CACHED_IMAGE}" localhost/e2e_deps:latest
    else
        echo "Building deps image..."
        build_deps_image
    fi
elif [ "${DEPS_CACHED_HASH}" != "${DEPS_HASH}" ]; then
    echo -e "${YELLOW}⚠️  Deps image is stale (lockfile changed: ${DEPS_CACHED_HASH:-unlabeled} → ${DEPS_HASH}). Rebuilding...${NC}"
    build_deps_image
else
    echo "Using local deps image (hash: ${DEPS_HASH})"
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

# Verify @playwright/test version in deps matches the MCR base image version.
# Mismatch means the deps image has a stale npm install — rebuild it.
PW_BASE_VERSION=$(grep '^FROM mcr.microsoft.com/playwright:' Dockerfile.playwright | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | tr -d 'v')
PW_DEPS_VERSION=$(podman run --rm localhost/e2e_deps:latest \
    node -e "process.stdout.write(require('/app/node_modules/@playwright/test/package.json').version)" 2>/dev/null || true)

if [ -n "${PW_BASE_VERSION}" ] && [ -n "${PW_DEPS_VERSION}" ] && [ "${PW_BASE_VERSION}" != "${PW_DEPS_VERSION}" ]; then
    echo -e "${YELLOW}⚠️  Playwright version mismatch: deps has ${PW_DEPS_VERSION}, base image requires ${PW_BASE_VERSION}. Rebuilding deps...${NC}"
    build_deps_image
fi

podman build --pull=newer -t e2e_playwright:latest -f Dockerfile.playwright ../../
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

# Captures the state of Podman's rootless networking stack when a pod's
# published ports don't work, so a real failure gives hard evidence (network
# backend in use, whether the pasta/rootlessport helper is even running, what
# the host thinks is listening) instead of forcing us to guess after the fact.
capture_network_diagnostics() {
    local out_dir="container-logs"
    mkdir -p "${out_dir}"
    local out_file="${out_dir}/podman-network-diagnostics-attempt-${POD_ATTEMPT}.txt"

    {
        echo "=== podman info ==="
        podman info

        echo ""
        echo "=== podman pod inspect ${POD_NAME} ==="
        podman pod inspect "${POD_NAME}"

        echo ""
        echo "=== rootless network helper processes (pasta/rootlessport/slirp4netns) ==="
        pgrep -af 'pasta|rootlessport|slirp4netns'

        echo ""
        echo "=== host-side listeners on published ports ==="
        ss -tlnp

        echo ""
        echo "=== /etc/subuid, /etc/subgid ==="
        cat /etc/subuid
        cat /etc/subgid

        echo ""
        echo "=== current process uid_map ==="
        cat /proc/self/uid_map

        echo ""
        echo "=== podman unshare uid_map (rootless container userns) ==="
        podman unshare cat /proc/self/uid_map
    } > "${out_file}" 2>&1

    echo -e "${BLUE}🔎 Network diagnostics saved to ${out_dir}/$(basename "${out_file}")${NC}"
}

# Podman's rootless port-publish setup occasionally fails to bind for a pod on
# GH-hosted runners (host↔pod forwarding never comes up, even though the
# Functions host itself starts and serves fine inside the pod). This is a
# transient environment race, not an app issue — recreating the pod fixes it,
# so we retry a bounded number of times here instead of failing the whole job.
start_pod_and_wait_for_backend() {
    echo -e "${BLUE}⏳ Step 2: Starting pod and services...${NC}"

    # Create the pod — publishes the ports that need host access
    #
    # NOTE: this function is invoked as the condition of `until ...; do` below,
    # a context in which bash suppresses `errexit` for the function's entire
    # execution. Each container-start command below must therefore check its
    # own exit status explicitly — otherwise a failure here (e.g. a port
    # conflict) would silently fall through to the health-check wait and only
    # surface ~180s later as a generic timeout instead of the real cause.
    # Force slirp4netns instead of the runner image's bundled pasta binary.
    # Diagnostics from a real failure (container-logs/podman-network-diagnostics-*)
    # showed pasta's listener bound and accepting on the host side for every
    # published port, yet zero bytes ever reached the container — a forwarding
    # bug in that specific pasta build, not a bind race. slirp4netns is the
    # apt-packaged (not runner-image-bundled) rootless backend and has its own
    # built-in port forwarder (port_handler=slirp4netns), bypassing pasta and
    # rootlessport entirely.
    podman pod create \
        --name "${POD_NAME}" \
        --network slirp4netns:port_handler=slirp4netns \
        --publish 7071:7071 \
        --publish 1433:1433 \
        --publish 27017:27017 \
        --publish 10000:10000 \
        --publish 10001:10001 \
        --publish 10002:10002 \
        || { echo -e "${RED}❌ Failed to create pod ${POD_NAME}${NC}"; return 1; }

    # From here on, something exists that the EXIT trap must tear down, even
    # if a later command in this function fails and returns early.
    CLEANUP_NEEDED=true

    # Start SQL Edge in the pod (from GHCR cache)
    podman run -d \
        --pod "${POD_NAME}" \
        --name cams-sqledge-e2e \
        -e ACCEPT_EULA=Y \
        -e MSSQL_SA_PASSWORD="${MSSQL_PASS}" \
        -e MSSQL_PID=Developer \
        "${IMAGE_SQLEDGE}" \
        || { echo -e "${RED}❌ Failed to start cams-sqledge-e2e${NC}"; return 1; }

    # Start MongoDB in the pod (from GHCR cache)
    podman run -d \
        --pod "${POD_NAME}" \
        --name cams-mongodb-e2e \
        "${IMAGE_MONGODB}" --bind_ip_all \
        || { echo -e "${RED}❌ Failed to start cams-mongodb-e2e${NC}"; return 1; }

    # Start Azurite in the pod (from GHCR cache)
    podman run -d \
        --pod "${POD_NAME}" \
        --name cams-azurite-e2e \
        "${IMAGE_AZURITE}" \
        azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 --location /data \
        || { echo -e "${RED}❌ Failed to start cams-azurite-e2e${NC}"; return 1; }

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
        -e CAMS_LOGIN_PROVIDER="${CAMS_LOGIN_PROVIDER}" \
        -e CAMS_LOGIN_PROVIDER_CONFIG="${CAMS_LOGIN_PROVIDER_CONFIG}" \
        -e CAMS_USER_GROUP_GATEWAY_CONFIG="${CAMS_USER_GROUP_GATEWAY_CONFIG}" \
        -e OKTA_API_KEY="${OKTA_API_KEY}" \
        e2e_backend:latest \
        || { echo -e "${RED}❌ Failed to start cams-backend-e2e${NC}"; return 1; }

    echo ""

    # Verify backend container started
    if ! podman ps --filter name=cams-backend-e2e --format "{{.Names}}" | grep -q cams-backend-e2e; then
        echo -e "${RED}❌ Backend container failed to start${NC}"
        podman logs cams-backend-e2e 2>&1 | tail -30
        return 1
    fi

    # Wait for backend healthcheck
    echo "Waiting for backend (databases + seeding + Functions host)..."
    local app_wait_count=0
    local app_max_wait=180

    while [ $app_wait_count -lt $app_max_wait ]; do
        local backend_status
        backend_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:7071/api/healthcheck 2>/dev/null || echo "000")
        if [ "$backend_status" = "200" ]; then
            echo -e "${GREEN}✅ Backend healthy${NC}"
            echo ""
            return 0
        fi
        echo -n "."
        sleep 2
        app_wait_count=$((app_wait_count + 2))
    done

    echo ""
    echo -e "${RED}❌ Backend failed to become healthy within ${app_max_wait}s${NC}"

    # Distinguish "app is broken" from "port forwarding to the pod is broken":
    # if the app answers when probed from inside its own container but never
    # once received a request via the published port, the pod's host↔pod
    # forwarding didn't come up — recreating the pod is the fix, not debugging the app.
    if podman exec cams-backend-e2e curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:7071/api/healthcheck 2>/dev/null | grep -q "200"; then
        echo -e "${YELLOW}⚠️  Backend responds when probed from inside its own container, but the published port never received a request — Podman host↔pod port forwarding likely failed to come up for this pod.${NC}"
    fi

    capture_network_diagnostics

    podman logs --tail 50 cams-backend-e2e 2>&1 | sed 's/^/  /'
    return 1
}

POD_ATTEMPT=1
POD_MAX_ATTEMPTS=2
until start_pod_and_wait_for_backend; do
    if [ "$POD_ATTEMPT" -ge "$POD_MAX_ATTEMPTS" ]; then
        echo ""
        echo -e "${RED}❌ Backend did not become healthy after ${POD_MAX_ATTEMPTS} attempts${NC}"
        exit 1
    fi
    POD_ATTEMPT=$((POD_ATTEMPT + 1))
    echo ""
    echo -e "${YELLOW}🔁 Recreating pod and retrying (attempt ${POD_ATTEMPT}/${POD_MAX_ATTEMPTS})...${NC}"
    echo ""
    podman pod stop "${POD_NAME}" 2>/dev/null || true
    podman pod rm -f "${POD_NAME}" 2>/dev/null || true
done

# Start frontend (standalone — not in pod, port 3000)
# Same slirp4netns override as the backend pod above: pasta's port-publish
# forwarding has shown the same "listener up, zero bytes forwarded" failure
# on standalone containers too, not just pods.
echo "Starting frontend..."
podman run -d \
    --name cams-frontend-e2e \
    --network slirp4netns:port_handler=slirp4netns \
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
    -e CAMS_BASE_PATH="${CAMS_BASE_PATH}" \
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
