#!/usr/bin/env bash
# Pre-commit hook: mechanical backstop ensuring a workflow step that sources a
# script from ops/scripts/pipeline/ is preceded by an actions/checkout IN THE
# SAME JOB (CAMS-760).
#
# `source ops/scripts/pipeline/_kv-to-env.sh` is a repo-relative path. Each job
# gets a fresh runner with an EMPTY workspace, so without its own checkout step
# the file is simply not there. The failure is not always loud: `source` on a
# missing file under `set -euo pipefail` aborts the step, but a job that sources
# the helper only to call kv_to_env inside a conditional -- or a step whose
# `continue-on-error` or trailing `|| true` swallows the status -- proceeds with
# the helper's functions undefined. The secret then never gets registered with
# ::add-mask::, which is precisely the leak _kv-to-env.sh exists to prevent, and
# nothing in the log says so.
#
# Ordering matters as much as presence: a checkout LATER in the job does not
# help the step that already ran (azure-remove-branch.yml's clean-up job is
# exactly this shape). So this guard compares line positions within the job,
# not mere co-occurrence.
#
# Nothing else catches this. actionlint does not know that `source <path>`
# implies a checked-out workspace, and the code path is often only reached on a
# schedule or on teardown, so CI on a PR would not exercise it either.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKFLOWS_DIR="$REPO_ROOT/.github/workflows"

if [[ ! -d "$WORKFLOWS_DIR" ]]; then
  echo "ERROR: guard target ${WORKFLOWS_DIR#"$REPO_ROOT"/} is missing." >&2
  echo "This hook can't check source/checkout ordering if the workflows directory" >&2
  echo "moved or was renamed. Re-point WORKFLOWS_DIR above, don't silently skip." >&2
  exit 1
fi

# Emits "file:line:job" for every sourcing step with no preceding checkout in
# its own job.
#
# Job boundaries are tracked by scoping to the top-level `jobs:` mapping first:
# a 2-space-indented key is a job name ONLY inside that block. `on:`, `env:`,
# `permissions:` and `concurrency:` all have 2-space children too (schedule:,
# group:, contents:), so keying off indentation alone would invent phantom jobs
# and split real ones.
#
# actions/checkout is matched by `actions/checkout@` regardless of what follows,
# because this repo pins to a commit SHA -- sometimes annotated `# v7.0.1`,
# sometimes `# main` -- and a version-tag pattern would miss the `# main` ones.
findings=$(awk '
  # Leaving the top-level jobs: mapping ends job scope.
  /^[^[:space:]#]/ {
    inJobs = ($0 ~ /^jobs:[[:space:]]*$/)
    job = ""
    next
  }
  !inJobs { next }

  # A 2-space key inside jobs: starts a new job. Reset the checkout marker:
  # a checkout in a PREVIOUS job does nothing for this one.
  /^  [A-Za-z_][A-Za-z0-9_-]*:[[:space:]]*(#.*)?$/ {
    job = $0
    sub(/^[[:space:]]+/, "", job)
    sub(/:.*$/, "", job)
    sawCheckout = 0
    next
  }
  job == "" { next }

  /uses:[[:space:]]*actions\/checkout@/ { sawCheckout = 1; next }

  # Both `source <path>` and POSIX `. <path>`, with or without a leading ./
  /(^|[[:space:];&|(])(source|\.)[[:space:]]+\.?\/?ops\/scripts\/pipeline\// {
    if (!sawCheckout) {
      printf "%s:%d:%s\n", FILENAME, FNR, job
    }
  }
' "$WORKFLOWS_DIR"/*.yml "$WORKFLOWS_DIR"/*.yaml 2>/dev/null || true)

# A guard that can never fire is worse than none: if the pattern stops matching
# anything at all, the sourcing convention changed and this hook needs updating
# rather than quietly passing forever.
totalSourceSites=$(grep -rlE '(source|\.)[[:space:]]+\.?/?ops/scripts/pipeline/' "$WORKFLOWS_DIR" | wc -l | tr -d ' ')
if [[ "$totalSourceSites" -eq 0 ]]; then
  echo "ERROR: no workflow sources anything from ops/scripts/pipeline/ anymore." >&2
  echo "If that convention was replaced, remove this guard consciously (see its" >&2
  echo "header); don't leave a hook that can no longer detect the bug it exists for." >&2
  exit 1
fi

if [[ -n "$findings" ]]; then
  echo "ERROR: workflow steps source a script from ops/scripts/pipeline/ with no" >&2
  echo "actions/checkout earlier in the same job. Each job runs on a fresh runner" >&2
  echo "with an empty workspace, so the file does not exist when the step runs:" >&2
  echo >&2
  while IFS=: read -r file line job; do
    printf '  %s:%s (job: %s)\n' "${file#"$REPO_ROOT"/}" "$line" "$job" >&2
  done <<<"$findings"
  echo >&2
  echo "Add an 'actions/checkout' step to each job above, BEFORE the sourcing step." >&2
  echo "A checkout later in the job does not help a step that already ran." >&2
  echo "See the comment at the top of this hook before removing it." >&2
  exit 1
fi
