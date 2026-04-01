#!/bin/bash

# Pull E2E base images from ghcr.io cache, self-healing on cache miss.
#
# On cache miss: pulls from upstream registry, pushes to ghcr.io for future runs.
# Self-healing pushes a single-arch image for the current platform. Use
# cache-base-images.sh to explicitly populate a full multi-arch manifest list.
#
# Usage:
#   ./pull-base-images.sh
#
# Environment:
#   GITHUB_TOKEN  — required (write:packages); sourced from gh CLI if not set
#   GITHUB_ACTOR  — GitHub username; sourced from gh CLI if not set

set -e

REGISTRY="ghcr.io/us-trustee-program/bankruptcy-oversight-support-systems"
PLATFORM="linux/$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')"

# Use GITHUB_TOKEN if set (CI), otherwise fall back to gh CLI (local dev)
if [ -z "${GITHUB_TOKEN:-}" ]; then
    GITHUB_TOKEN=$(gh auth token 2>/dev/null) || true
    GITHUB_ACTOR=$(gh api user --jq '.login' 2>/dev/null) || true
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "⚠️  Not logged in to gh CLI — skipping ghcr.io pull, podman will fetch upstream"
    exit 0
fi

echo "${GITHUB_TOKEN}" | podman login ghcr.io --username "${GITHUB_ACTOR}" --password-stdin

# Pull from ghcr.io cache; on miss, pull upstream and repopulate.
# Pass --force as third argument to always repull from upstream and refresh the cache.
pull_base_image() {
    local cached="$1"
    local upstream="$2"
    local force="${3:-}"

    if [ -z "${force}" ] && podman pull "${cached}" 2>/dev/null; then
        echo "  ✓ Pulled from cache: ${cached}"
    else
        echo "  ⚠️  Pulling from upstream and repopulating cache: ${upstream}"
        podman pull --platform "${PLATFORM}" "${upstream}"
        podman tag "${upstream}" "${cached}"
        podman push "${cached}"
        echo "  ✓ Upstream pulled and cached: ${cached}"
    fi
}

pull_base_image "${REGISTRY}/e2e-base-mongo-7.0"                    "mongo:7.0"
pull_base_image "${REGISTRY}/e2e-base-azure-sql-edge-latest"         "mcr.microsoft.com/azure-sql-edge:latest"
# Force-refresh Azurite: the cached image has a SharedKey HMAC incompatibility with
# Azure Functions extension bundle v4. Always pull upstream until cache is confirmed good.
pull_base_image "${REGISTRY}/e2e-base-azure-storage-azurite-latest"  "mcr.microsoft.com/azure-storage/azurite:latest"  "--force"

echo "✅ Base images ready"
