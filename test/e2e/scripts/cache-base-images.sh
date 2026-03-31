#!/bin/bash

# Cache upstream base images to GitHub Container Registry (ghcr.io) as multi-arch manifest lists.
#
# Stores both linux/amd64 and linux/arm64 variants under a single manifest list so that
# CI (x86-64) and local macOS (arm64) both pull the correct architecture automatically.
#
# All three images ship native linux/arm64 builds and are stored as multi-arch manifest lists.
#
# Run this manually whenever upstream images need to be refreshed.
#
# Usage:
#   export GITHUB_TOKEN=<token>         # requires write:packages scope
#   export GITHUB_ACTOR=<github-username>
#   ./cache-base-images.sh
#
# Prerequisites:
#   - podman with manifest support (podman >= 4.x)

set -e

REGISTRY="ghcr.io/us-trustee-program/bankruptcy-oversight-support-systems"

# Images with full multi-arch support (amd64 + arm64)
MULTIARCH_IMAGES=(
  "mongo:7.0"
  "mcr.microsoft.com/azure-sql-edge:latest"
  "mcr.microsoft.com/azure-storage/azurite:latest"
)

# Derive a cache tag from the source image name (strip registry prefix, replace / and : with -)
cache_tag() {
  local image="$1"
  local name
  name="${image#*/}"
  echo "$name" | tr '/: ' '---'
}

echo "Logging in to ghcr.io..."
if [ -z "${GITHUB_TOKEN:-}" ]; then
  GITHUB_TOKEN=$(gh auth token 2>/dev/null) || true
  GITHUB_ACTOR=$(gh api user --jq '.login' 2>/dev/null) || true
fi
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Could not obtain a GitHub token. Either:"
  echo "  - Log in with: gh auth login"
  echo "  - Or set GITHUB_TOKEN manually (requires write:packages scope)"
  exit 1
fi
echo "${GITHUB_TOKEN}" | podman login ghcr.io --username "${GITHUB_ACTOR}" --password-stdin
echo ""

# Push a multi-arch manifest list for images that have both amd64 and arm64 builds
for image in "${MULTIARCH_IMAGES[@]}"; do
  tag=$(cache_tag "$image")
  dest="${REGISTRY}/e2e-base-${tag}"

  echo "📦 ${image} → ${dest}"

  amd64="${dest}-amd64"
  arm64="${dest}-arm64"

  echo "  Pulling linux/amd64..."
  podman pull --platform linux/amd64 "${image}"
  podman tag "${image}" "${amd64}"
  podman push "${amd64}"

  echo "  Pulling linux/arm64..."
  podman pull --platform linux/arm64 "${image}"
  podman tag "${image}" "${arm64}"
  podman push "${arm64}"

  echo "  Creating manifest list..."
  podman manifest rm "${dest}" 2>/dev/null || true
  podman manifest create "${dest}"
  podman manifest add "${dest}" "${amd64}"
  podman manifest add "${dest}" "${arm64}"
  podman manifest push --all "${dest}"

  echo "  ✅ Done"
  echo ""
done

echo "All images cached to ghcr.io."
echo "Update podman-compose.yml image references if upstream versions changed."
