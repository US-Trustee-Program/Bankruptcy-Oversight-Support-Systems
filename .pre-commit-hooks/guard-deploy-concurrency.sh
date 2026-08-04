#!/usr/bin/env bash
# Pre-commit hook: mechanical backstop ensuring the cams-branch-<hash>
# concurrency guarantee on the deploy chain can't be silently reopened
# (CAMS-760, GH #2749 bug shape).
#
# reusable-deploy.yml's deploy-azure-infrastructure job has no concurrency
# group of its own. The guarantee that a nightly teardown (azure-remove-
# branch.yml) can't run while a deploy is still in flight relies entirely
# on continuous-deployment.yml's `deploy` job declaring
# `concurrency: group: cams-branch-<hash>` — that job's lock is held for
# the ENTIRE nested call chain (sub-deploy.yml -> reusable-deploy.yml, and
# sub-deploy.yml's own deploy-code-slot -> sub-deploy-code-slot.yml), with
# no release/reacquire gap. This is otherwise a comment-only contract:
# nothing else would catch a future second caller of reusable-deploy.yml or
# sub-deploy.yml (bypassing the guarded `deploy` job), or an edit that drops
# the concurrency block from `deploy` itself, from silently reintroducing
# the exact race this backstop exists to prevent. Only auto-verifies the
# current single-caller call chain — if reusable-deploy.yml or
# sub-deploy.yml ever gets a second caller, this guard fails and needs a
# human to decide how the new caller should be protected before updating it.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKFLOWS_DIR="$REPO_ROOT/.github/workflows"
CONTINUOUS_DEPLOYMENT="$WORKFLOWS_DIR/continuous-deployment.yml"

fail_multi_caller() {
  local target="$1" callers="$2"
  echo "ERROR: ${target} now has more than one caller:" >&2
  echo "${callers}" >&2
  echo "Each caller's job (or an ancestor of it) MUST hold the" >&2
  echo "'cams-branch-<hash>' concurrency group for its entire duration — see" >&2
  echo "continuous-deployment.yml's 'deploy' job and its comment. This guard" >&2
  echo "only auto-verifies the single-caller case; review manually and update" >&2
  echo "this hook once the new caller is confirmed safe." >&2
  exit 1
}

if [[ ! -d "$WORKFLOWS_DIR" ]]; then
  echo "ERROR: guard target ${WORKFLOWS_DIR#"$REPO_ROOT"/} is missing." >&2
  exit 1
fi

reusableDeployCallers=$(grep -rl 'uses: \./\.github/workflows/reusable-deploy\.yml' "$WORKFLOWS_DIR" || true)
if [[ -z "$reusableDeployCallers" ]]; then
  echo "ERROR: no caller of reusable-deploy.yml found. If it was renamed or" >&2
  echo "removed, update or remove this guard consciously (see its header)." >&2
  exit 1
fi
if [[ "$(echo "$reusableDeployCallers" | wc -l | tr -d ' ')" -ne 1 ]]; then
  fail_multi_caller "reusable-deploy.yml" "$reusableDeployCallers"
fi
if [[ "$(basename "$reusableDeployCallers")" != "sub-deploy.yml" ]]; then
  echo "ERROR: reusable-deploy.yml's only caller changed from sub-deploy.yml to" >&2
  echo "${reusableDeployCallers#"$REPO_ROOT"/}. Review whether the new caller is" >&2
  echo "protected by the cams-branch-<hash> concurrency group before updating" >&2
  echo "this guard." >&2
  exit 1
fi

subDeployCallers=$(grep -rl 'uses: \./\.github/workflows/sub-deploy\.yml' "$WORKFLOWS_DIR" || true)
if [[ -z "$subDeployCallers" ]]; then
  echo "ERROR: no caller of sub-deploy.yml found. If it was renamed or removed," >&2
  echo "update or remove this guard consciously (see its header)." >&2
  exit 1
fi
if [[ "$(echo "$subDeployCallers" | wc -l | tr -d ' ')" -ne 1 ]]; then
  fail_multi_caller "sub-deploy.yml" "$subDeployCallers"
fi
if [[ "$(basename "$subDeployCallers")" != "continuous-deployment.yml" ]]; then
  echo "ERROR: sub-deploy.yml's only caller changed from continuous-deployment.yml" >&2
  echo "to ${subDeployCallers#"$REPO_ROOT"/}. Review whether the new caller is" >&2
  echo "protected by the cams-branch-<hash> concurrency group before updating" >&2
  echo "this guard." >&2
  exit 1
fi

if [[ ! -f "$CONTINUOUS_DEPLOYMENT" ]]; then
  echo "ERROR: guard target ${CONTINUOUS_DEPLOYMENT#"$REPO_ROOT"/} is missing." >&2
  exit 1
fi

# The `deploy` job block runs from its `deploy:` header to the next
# top-level (2-space-indented) job key. Extract just that block and confirm
# it both calls sub-deploy.yml and declares the concurrency group — doing
# both checks on the same slice (not the whole file) so a concurrency block
# on some OTHER job can't produce a false pass.
deployJobBlock=$(awk '
  /^  deploy:$/ { capture=1 }
  capture && /^  [a-zA-Z_-]+:$/ && !/^  deploy:$/ { exit }
  capture { print }
' "$CONTINUOUS_DEPLOYMENT")

if [[ -z "$deployJobBlock" ]] || ! grep -q 'uses: \./\.github/workflows/sub-deploy\.yml' <<< "$deployJobBlock"; then
  echo "ERROR: could not find a 'deploy:' job in ${CONTINUOUS_DEPLOYMENT#"$REPO_ROOT"/}" >&2
  echo "that calls sub-deploy.yml. If this job was renamed, update this guard" >&2
  echo "(and confirm the concurrency group moved with it)." >&2
  exit 1
fi

if ! grep -q 'group: cams-branch-' <<< "$deployJobBlock"; then
  echo "ERROR: continuous-deployment.yml's 'deploy' job no longer declares the" >&2
  echo "'cams-branch-<hash>' concurrency group. This is the ONLY thing preventing" >&2
  echo "a nightly teardown from running against a branch while any part of its" >&2
  echo "deploy chain is still in flight (GH #2749 bug shape). See the comment at" >&2
  echo "the top of this hook and on the 'deploy' job itself before removing it." >&2
  exit 1
fi
