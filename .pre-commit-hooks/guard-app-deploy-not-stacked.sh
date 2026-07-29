#!/usr/bin/env bash
# Pre-commit hook: mechanical backstop against re-stacking the app deploy
# (PR #2757 review, CAMS-760, GH #2749).
#
# main.bicep currently deploys the app-config Key Vault + its managed identity
# + role assignments (via the kvSetup module) cross-scope into the shared
# AZURE_RG. An Azure Deployment Stack manages every resource its template
# creates in ANY resource group, so wrapping azure-deploy.sh's app deploy in
# `az stack group create` while main.bicep still creates the shared KV would
# let a branch's stack delete that shared KV on teardown — the exact incident
# this fix addresses. There is no lint rule or test that would otherwise catch
# a future PR reintroducing this.
#
# If a later change (e.g. CAMS-760 Slice 2) extracts the shared KV/identity
# setup out of main.bicep into its own always-plain deployment first, stacking
# the remaining app-RG-scoped resources becomes safe — update or remove this
# guard consciously at that point, don't just delete it to unblock a commit.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
TARGET="$REPO_ROOT/ops/scripts/pipeline/azure-deploy.sh"

if [[ ! -f "$TARGET" ]]; then
  exit 0
fi

if grep -q 'stack group create' "$TARGET"; then
  echo "ERROR: ${TARGET#"$REPO_ROOT"/} contains 'stack group create'." >&2
  echo "main.bicep still creates the shared app-config Key Vault (kvSetup module)" >&2
  echo "cross-scope in AZURE_RG. Stacking the app deploy while that's true would let" >&2
  echo "a branch's teardown delete the shared Key Vault again (GH #2749)." >&2
  echo "See the comment at the top of this hook before removing it." >&2
  exit 1
fi
