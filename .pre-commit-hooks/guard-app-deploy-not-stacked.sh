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

# Scans every file in main.bicep's own stacked module tree, not just
# main.bicep itself — the bug this guard exists to catch (a fixed-name,
# cross-scope shared resource inside a per-branch stack) has already
# reappeared once in a module main.bicep calls (acs-email.bicep's KV
# secrets), not in main.bicep's own text.
REPO_ROOT="$(git rev-parse --show-toplevel)"
TARGETS=(
  "$REPO_ROOT/ops/cloud-deployment/main.bicep"
  "$REPO_ROOT/ops/cloud-deployment/backend-api-deploy.bicep"
  "$REPO_ROOT/ops/cloud-deployment/dataflows-resource-deploy.bicep"
  "$REPO_ROOT/ops/cloud-deployment/frontend-webapp-deploy.bicep"
  "$REPO_ROOT/ops/cloud-deployment/lib/email/acs-email.bicep"
  "$REPO_ROOT/ops/cloud-deployment/lib/monitoring-alerts/alert-action-group.bicep"
)
# Whenever main.bicep gains a NEW cross-scope module call (any module with
# a `scope:` pointing outside the per-branch app RG), add it here too — the
# actionGroup module above is already one example, currently dormant only
# because createAlerts defaults false for branches. Nothing else in CI or
# this hook derives this list automatically; it's a manually maintained
# enumeration of main.bicep's stacked module tree.

for TARGET in "${TARGETS[@]}"; do
  if [[ ! -f "$TARGET" ]]; then
    echo "ERROR: guard target ${TARGET#"$REPO_ROOT"/} is missing." >&2
    echo "This hook can't check for a re-stacked app deploy if a target moved or was" >&2
    echo "renamed. Re-point TARGETS above (see the comment at the top of this hook)," >&2
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

  # A quoted secretName with no ${...} interpolation at all is a FIXED,
  # shared name — every branch's stack would capture and delete it on
  # teardown (the acsEmail bug shape, GH #2749). Every secret written from
  # this stacked tree must be branch-qualified (e.g. 'NAME-${stackName}').
  # app-shared-setup.bicep's own KV-setup module is intentionally exempt —
  # it's caught by the check above instead if it ever gets inlined here.
  # shellcheck disable=SC2016 # REASON: '\${' is a literal grep pattern (the two characters $ and {), not intended for shell expansion
  fixedSecretNames=$(grep -oE "secretName:[[:space:]]*'[^']*'" "$TARGET" | grep -v '\${' || true)
  if [[ -n "${fixedSecretNames}" ]]; then
    echo "ERROR: ${TARGET#"$REPO_ROOT"/} writes a Key Vault secret with a FIXED" >&2
    echo "(non-interpolated) name: ${fixedSecretNames}" >&2
    echo "Files in main.bicep's stacked module tree must only write branch-qualified" >&2
    echo "secret names, never a fixed one — a fixed name gets captured by every" >&2
    echo "branch's stack and deleted on that branch's teardown (GH #2749)." >&2
    echo "See the comment at the top of this hook before removing it." >&2
    exit 1
  fi
done
