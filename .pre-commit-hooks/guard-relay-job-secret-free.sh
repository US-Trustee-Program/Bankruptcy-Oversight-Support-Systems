#!/usr/bin/env bash
# Pre-commit hook: mechanical backstop ensuring azure-remove-branch.yml's
# `relay` job never references a secret (CAMS-884 bug shape).
#
# `check` needs Azure credentials (azure/login) and GITHUB_TOKEN to do its
# discovery work, so its own job-level outputs are permanently exposed to
# GitHub's "may contain secret" output-masking guard -- which has silently
# dropped `targetBranchHashIds` for any branch whose hash happens to collide
# with a masked value (e.g. hash ff3151), crashing `clean-up`'s
# `fromJSON(...)` matrix and leaking the Azure environment with no teardown
# and no clear error. The fix is the `relay` job: it references ZERO
# secrets/tokens, so it has nothing registered for the masking guard to
# match against, and its own outputs (re-emitted from an artifact `check`
# uploads) are therefore safe to feed into `clean-up`'s matrix.
#
# This property is NOT self-maintaining -- it decays the moment anyone adds
# a `secrets.*` reference to the `relay` job (e.g. "just need this one
# token for a quick fix"), silently reintroducing the exact bug this guard
# exists to prevent, with no warning until a branch hash happens to collide
# again. This hook makes that impossible to do silently.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKFLOW="$REPO_ROOT/.github/workflows/azure-remove-branch.yml"

if [[ ! -f "$WORKFLOW" ]]; then
  echo "ERROR: guard target ${WORKFLOW#"$REPO_ROOT"/} is missing." >&2
  exit 1
fi

# The `relay:` job block runs from its `relay:` header to the next top-level
# (2-space-indented) job key. Extract just that block so a `secrets.`
# reference in some OTHER job can't produce a false failure here.
relayJobBlock=$(awk '
  /^  relay:$/ { capture=1 }
  capture && /^  [a-zA-Z_-]+:$/ && !/^  relay:$/ { exit }
  capture { print }
' "$WORKFLOW")

if [[ -z "$relayJobBlock" ]]; then
  echo "ERROR: could not find a 'relay:' job in ${WORKFLOW#"$REPO_ROOT"/}." >&2
  echo "If this job was renamed or removed, update or remove this guard" >&2
  echo "consciously (see its header comment) -- do not just let it silently" >&2
  echo "stop checking anything." >&2
  exit 1
fi

if grep -q 'secrets\.' <<< "$relayJobBlock"; then
  echo "ERROR: azure-remove-branch.yml's 'relay' job now references a secret." >&2
  echo "This job's ENTIRE purpose is to have nothing registered for GitHub's" >&2
  echo "'may contain secret' output-masking guard to match against -- adding" >&2
  echo "a secret here can silently reintroduce the branch-hash-collision bug" >&2
  echo "this job exists to fix (CAMS-884 / .github/workflows/azure-remove-branch.yml's" >&2
  echo "relay job comment). Move whatever needs this secret into a different" >&2
  echo "job instead." >&2
  exit 1
fi
