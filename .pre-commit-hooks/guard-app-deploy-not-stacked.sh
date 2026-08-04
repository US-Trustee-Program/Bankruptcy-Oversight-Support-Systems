#!/usr/bin/env bash
# Pre-commit hook: mechanical backstop against re-introducing the GH #2749 bug
# shape (CAMS-760).
#
# azure-deploy.sh's app deploy IS now stacked for branches (CAMS-760, Option E
# / Slice 2) — that's safe ONLY because main.bicep no longer creates the shared
# app-config Key Vault (formerly the kvSetup module) cross-scope into the
# shared AZURE_RG; that setup was extracted into app-shared-setup.bicep, always
# a plain (non-stack) deployment (see that file's header comment). An Azure
# Deployment Stack manages every resource its template creates in ANY resource
# group, so if a future change re-inlines a shared, fixed-name, cross-scope
# resource (like the KV) into main.bicep, a branch's own app stack teardown
# would delete it again — the exact incident this guard exists to catch, since
# there is no lint rule or test that would otherwise catch it.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
TARGET="$REPO_ROOT/ops/cloud-deployment/main.bicep"

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: guard target ${TARGET#"$REPO_ROOT"/} is missing." >&2
  echo "This hook can't check for a re-stacked app deploy if its target moved or was" >&2
  echo "renamed. Re-point TARGET above (see the comment at the top of this hook)," >&2
  echo "don't silently skip the check." >&2
  exit 1
fi

if grep -q 'kvSetup\|ustp-cams-kv-app-config-setup' "$TARGET"; then
  echo "ERROR: ${TARGET#"$REPO_ROOT"/} references the app-config Key Vault setup." >&2
  echo "main.bicep's app deploy is stacked for branches (CAMS-760, Option E / Slice 2)." >&2
  echo "The shared Key Vault must stay in app-shared-setup.bicep's always-plain" >&2
  echo "deployment, never cross-scope inside this stacked template (GH #2749)." >&2
  echo "See the comment at the top of this hook before removing it." >&2
  exit 1
fi
