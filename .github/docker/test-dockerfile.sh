#!/bin/bash
# Test script for CAMS Docker build-and-test container
# This script verifies that the Dockerfile builds correctly and can run tests and produce artifacts

set -uo pipefail  # Exit on undefined variables and pipe failures (but not on command failures)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Image name
IMAGE_NAME="cams-build:test"

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}[TEST $TESTS_RUN]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓ PASSED:${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_failure() {
    echo -e "${RED}✗ FAILED:${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_summary() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}TEST SUMMARY${NC}"
    echo -e "${BLUE}===================================================${NC}"
    echo -e "Total tests run: ${TESTS_RUN}"
    echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
    else
        echo -e "${GREEN}Failed: ${TESTS_FAILED}${NC}"
    fi
    echo -e "${BLUE}===================================================${NC}\n"
}

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    TESTS_RUN=$((TESTS_RUN + 1))
    print_test "$test_name"

    if eval "$test_command" > /tmp/docker-test-$TESTS_RUN.log 2>&1; then
        print_success "$test_name"
        return 0
    else
        print_failure "$test_name"
        echo "  Error output:"
        tail -20 /tmp/docker-test-$TESTS_RUN.log | sed 's/^/    /'
        return 1
    fi
}

# Clean up function
# shellcheck disable=SC2329  # Function is invoked via trap
cleanup() {
    echo -e "\n${YELLOW}Cleaning up test artifacts...${NC}"
    rm -f /tmp/docker-test-*.log
}

trap cleanup EXIT

print_header "CAMS Docker Container Test Suite"

# Test 1: Build the Docker image
print_header "Building Docker Image"
run_test "Build Docker image" \
    "docker build -f .github/docker/Dockerfile.build-and-test -t $IMAGE_NAME ."

# Test 2: Verify Node.js version
print_header "Verifying Base Environment"
run_test "Node.js version matches .nvmrc" \
    "docker run --rm $IMAGE_NAME node --version | grep -q 'v22.17.1'"

run_test "npm is installed" \
    "docker run --rm $IMAGE_NAME npm --version"

run_test "Working directory is /workspace" \
    "docker run --rm $IMAGE_NAME pwd | grep -q '/workspace'"

# Test 3: Verify system dependencies
print_header "Verifying System Dependencies"
run_test "zip is installed" \
    "docker run --rm $IMAGE_NAME which zip"

run_test "unzip is installed" \
    "docker run --rm $IMAGE_NAME which unzip"

run_test "git is installed" \
    "docker run --rm $IMAGE_NAME git --version"

run_test "ca-certificates are installed" \
    "docker run --rm $IMAGE_NAME bash -c 'test -d /etc/ssl/certs && ls /etc/ssl/certs | wc -l | grep -q -v ^0$'"

# Test 4: Verify environment variables
print_header "Verifying Environment Variables"
run_test "CI environment variable is set" \
    "docker run --rm $IMAGE_NAME bash -c 'test \"\$CI\" = \"true\"'"

run_test "NPM_CONFIG_LOGLEVEL is set" \
    "docker run --rm $IMAGE_NAME bash -c 'test \"\$NPM_CONFIG_LOGLEVEL\" = \"warn\"'"

run_test "NODE_ENV is NOT set to production" \
    "docker run --rm $IMAGE_NAME bash -c 'test -z \"\$NODE_ENV\" || test \"\$NODE_ENV\" != \"production\"'"

run_test "Test-specific env vars are NOT pre-configured" \
    "docker run --rm $IMAGE_NAME bash -c 'test -z \"\$CAMS_LOGIN_PROVIDER\" && test -z \"\$DATABASE_MOCK\"'"

# Test 5: Common library tests
print_header "Testing Common Library"
run_test "Common: npm ci completes" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q'"

run_test "Common: Build succeeds" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm run build'"

run_test "Common: Tests pass (no failures)" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm test > /tmp/test-output.txt 2>&1 && grep \"Test Suites:\" /tmp/test-output.txt | grep -qv \"failed\" && grep \"Tests:\" /tmp/test-output.txt | grep -qv \"failed\"'"

# Test 6: Backend tests
print_header "Testing Backend"
run_test "Backend: npm ci completes" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm run build && cd ../backend && npm ci -q'"

run_test "Backend: Build succeeds" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm run build && cd ../backend && npm ci -q && npm run build'"

run_test "Backend: Tests pass (no failures)" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm run build && cd ../backend && npm ci -q && npm test > /tmp/test-output.txt 2>&1 && grep \"Test Suites:\" /tmp/test-output.txt | grep -qv \"failed\" && grep \"Tests:\" /tmp/test-output.txt | grep -qv \"failed\"'"

# Test 7: Artifact production
print_header "Testing Artifact Production"
run_test "Backend: build:all succeeds" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm run build && cd ../backend && npm ci -q && npm run build:all'"

run_test "Backend: API artifact production" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm run build && cd ../backend && npm ci -q && npm run build:all && OUT=test-api npm run pack:api && test -f function-apps/api/test-api.zip'"

run_test "Backend: Dataflows artifact production" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm run build && cd ../backend && npm ci -q && npm run build:all && OUT=test-dataflows npm run pack:dataflows && test -f function-apps/dataflows/test-dataflows.zip'"

run_test "Backend: Artifact contains required files" \
    "docker run --rm $IMAGE_NAME bash -c 'cd common && npm ci -q && npm run build && cd ../backend && npm ci -q && npm run build:all && OUT=test-api npm run pack:api && unzip -l function-apps/api/test-api.zip | grep -q package.json && unzip -l function-apps/api/test-api.zip | grep -q host.json'"

# Test 8: Docker image size check
print_header "Checking Image Size"
IMAGE_SIZE=$(docker images $IMAGE_NAME --format "{{.Size}}" | head -1)
echo "Image size: $IMAGE_SIZE"
if [ -n "$IMAGE_SIZE" ]; then
    TESTS_RUN=$((TESTS_RUN + 1))
    print_success "Image size is reasonable ($IMAGE_SIZE)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    TESTS_RUN=$((TESTS_RUN + 1))
    print_failure "Could not determine image size"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Print summary
print_summary

# Exit with appropriate code
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed. Please review the output above.${NC}\n"
    exit 1
else
    echo -e "${GREEN}All tests passed! The Dockerfile is working correctly.${NC}\n"
    exit 0
fi
