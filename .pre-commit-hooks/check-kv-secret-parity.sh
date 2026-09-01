#!/usr/bin/env bash
# Pre-commit hook: keep each federated-credential runbook's KV_SECRETS array
# in sync with the Key Vault secrets its tagged workflow(s) actually read.
#
# Four invariants are asserted. Three are reachable by walking runbooks; the
# fourth is not, which is why the workflow-side pass at the bottom exists
# rather than this being a single loop:
#
#   1. Every runbook carries a "# KV-Workflows: <file>[,<file>]" tag.
#   2. Every workflow named by such a tag exists.
#   3. Every Key Vault secret reference in a tagged workflow appears in that
#      runbook's KV_SECRETS — a gap there means the deploy identity was never
#      granted access to the secret. See extract_secret_names_from_stream for
#      the call shapes that count as a reference.
#   4. Every workflow that reads a Key Vault secret is named by at least one
#      runbook's tag. A workflow no runbook tags is never reached by the
#      runbook walk, so without this it passes silently — exactly the case
#      when a new workflow is added, when the author is least likely to know
#      the grant is a separate step.
#
# Invariants 1 and 2 are properties of a runbook and are invisible from the
# workflow side; invariant 4 is the converse. Reversing the traversal would
# trade one blind spot for two, so both indexes are built and asserted over.
#
# All four invariants are gated on recognizing a secret reference in the first
# place, so an extractor that matches nothing makes the whole hook pass
# vacuously. A self-test below asserts the extractor still finds a plausible
# number of reads and still recognizes every known call shape.
#
# Two things no local check can confirm, both reported rather than enforced:
#   - Whether a referenced secret actually exists in Azure Key Vault. If a
#     changed workflow references a secret name absent at HEAD, a non-blocking
#     reminder is printed.
#   - Whether a runbook was re-run after its KV_SECRETS array changed. Editing
#     the array changes what would be granted; only running it grants.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RUNBOOK_DIR="$REPO_ROOT/ops/scripts/utility/federated-credentials"
WORKFLOW_DIR="$REPO_ROOT/.github/workflows"

exit_code=0

# Index of every workflow named by some runbook's tag, accumulated during the
# runbook walk below and asserted against in the workflow walk at the bottom.
all_tagged_workflows=()

extract_kv_secrets() {
  sed -n '/^KV_SECRETS=(/,/)/p' "$1" | grep -oE '"[A-Za-z0-9_-]+"' | tr -d '"'
}

extract_kv_workflows() {
  grep -m1 '^# KV-Workflows:' "$1" | sed 's/^# KV-Workflows: *//' | tr ',' ' '
}

# Two call shapes read a Key Vault secret, and both must be recognized or the
# checks below pass vacuously (see the self-test after this block):
#
#   Legacy, inline az cli. Still used by ops/scripts/pipeline/az-cosmos-deploy.sh
#   and available to any future workflow:
#     az keyvault secret show --vault-name X --name SECRET-NAME --query value
#
#   Current, via the shared helper in ops/scripts/pipeline/_kv-to-env.sh, whose
#   THIRD positional argument is the secret name:
#     kv_to_env ENV_NAME "$KV" SECRET-NAME
#     kv_to_env ENV_NAME "$KV" SECRET-NAME --optional [DEFAULT]
#     kv_get    OUT_VAR  "$KV" SECRET-NAME [--optional [DEFAULT]]
#     if   ! kv_to_env ENV_NAME "$KV" SECRET-NAME; then
#     elif ! kv_to_env ENV_NAME "$KV" SECRET-NAME; then
#
# The vault argument is matched as "any non-blank token" on purpose: it appears
# as "$KV", "${KV}" and as a literal vault name, and only the third argument
# matters here. Anchoring on the function name plus argument *position* rather
# than on the surrounding statement is what makes the guarded 'if !' / 'elif !'
# forms fall out for free.
#
# Reads from stdin so the working-tree walk and the git-show comparison in
# remind_if_new_secret cannot drift apart — they did once, when only the working
# tree was taught the new shape.
extract_secret_names_from_stream() {
  local content
  content="$(cat)"

  # '|| true' on each pipeline is load-bearing twice over: these run inside
  # process substitutions where 'set -e' would exit the subshell, so a first
  # pattern that matches nothing would otherwise silently discard the second
  # pattern's output entirely.
  { printf '%s\n' "$content" \
    | grep -E 'keyvault secret show' \
    | grep -oE -- '--name [A-Za-z0-9_-]+' \
    | awk '{print $2}'; } || true

  { printf '%s\n' "$content" \
    | grep -oE '\bkv_(to_env|get)[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]+[^[:space:]]+[[:space:]]+"?[A-Za-z0-9_-]+"?' \
    | awk '{print $4}' \
    | tr -d '"'; } || true
}

extract_workflow_secret_names() {
  extract_secret_names_from_stream < "$1"
}

remind_if_new_secret() {
  local wf_path="$1" rel added
  rel="${wf_path#"$REPO_ROOT"/}"
  git cat-file -e "HEAD:$rel" 2>/dev/null || return 0

  added=$(comm -13 \
    <(git show "HEAD:$rel" | extract_secret_names_from_stream | sort -u) \
    <(extract_workflow_secret_names "$wf_path" | sort -u))

  if [[ -n "$added" ]]; then
    echo ""
    echo "REMINDER: $rel references new Key Vault secret(s):"
    while IFS= read -r name; do echo "  - $name"; done <<< "$added"
    echo "  Before merging, confirm each secret exists in BOTH kv-ustp-cams and"
    echo "  kv-ustp-cams-dev, then run the matching runbook in"
    echo "  ops/scripts/utility/federated-credentials/ with TARGET=main and TARGET=branch."
  fi
}

# --- Self-test: does the extractor still see anything at all? ---------------
#
# Every invariant below is gated on extract_workflow_secret_names returning
# something. When it returns nothing the hook still exits 0, but vacuously:
# required_secrets is empty so runbook parity passes trivially, and the coverage
# loop 'continue's past every workflow. That is not a hypothetical — a refactor
# that replaced 82 inline 'az keyvault secret show' calls with helper calls
# dropped the extractor to 0 matches and the hook kept reporting success.
#
# So assert a floor, not merely non-emptiness: a regex that breaks for one call
# shape while others still match would slip past a '> 0' test. If a change
# legitimately removes reads, lower this deliberately in the same commit.
MIN_EXPECTED_WORKFLOW_SECRET_READS=60

self_test() {
  local total shape_output shape wf_path

  total=0
  for wf_path in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
    [[ -f "$wf_path" ]] || continue
    total=$(( total + $(extract_workflow_secret_names "$wf_path" | grep -c . || true) ))
  done

  if (( total < MIN_EXPECTED_WORKFLOW_SECRET_READS )); then
    echo "ERROR: self-test failed — extract_workflow_secret_names found only $total Key" >&2
    echo "       Vault secret reads across .github/workflows/, below the expected floor" >&2
    echo "       of $MIN_EXPECTED_WORKFLOW_SECRET_READS. Every check in this hook is gated on that extraction, so" >&2
    echo "       it would now pass vacuously rather than actually verify anything." >&2
    echo "       Either the extractor no longer recognizes how workflows read secrets" >&2
    echo "       (a new call shape was introduced — teach it to the regexes above), or" >&2
    echo "       the reads were genuinely removed (lower the floor in this commit)." >&2
    exit_code=1
  fi

  # Per-shape assertions. The count floor above catches a wholesale collapse;
  # this catches one shape silently going unrecognized while the total stays up.
  # Each fixture line must yield exactly SELF-TEST-SECRET.
  while IFS= read -r shape; do
    [[ -n "$shape" ]] || continue
    shape_output="$(printf '%s\n' "$shape" | extract_secret_names_from_stream)"
    if [[ "$shape_output" != "SELF-TEST-SECRET" ]]; then
      echo "ERROR: self-test failed — extract_secret_names_from_stream no longer" >&2
      echo "       recognizes this call shape:" >&2
      echo "         $shape" >&2
      echo "       expected 'SELF-TEST-SECRET', got '${shape_output:-<nothing>}'." >&2
      exit_code=1
    fi
  done <<'SHAPES'
az keyvault secret show --vault-name kv-ustp-cams --name SELF-TEST-SECRET --query value -o tsv
          kv_to_env SELF_TEST "$KV" SELF-TEST-SECRET
          kv_to_env SELF_TEST "${KV}" SELF-TEST-SECRET
          kv_to_env SELF_TEST kv-ustp-cams SELF-TEST-SECRET
          kv_to_env SELF_TEST "$KV" SELF-TEST-SECRET --optional
          kv_to_env SELF_TEST "$KV" SELF-TEST-SECRET --optional EP1
          kv_to_env SELF_TEST "$KV" SELF-TEST-SECRET --optional "${AZ_LOCATION}"
          kv_get self_test_out "$KV" SELF-TEST-SECRET
          kv_get self_test_out "$KV" SELF-TEST-SECRET --optional
          if ! kv_to_env SELF_TEST "$KV" SELF-TEST-SECRET; then
          elif ! kv_to_env SELF_TEST "$KV" SELF-TEST-SECRET; then
SHAPES
}

self_test

for script in "$RUNBOOK_DIR"/setup-*-federated-credential.sh; do
  [[ -f "$script" ]] || continue

  # '|| true' is load-bearing: extract_kv_workflows greps, and a runbook with
  # no tag makes grep exit 1, which under 'set -e' with pipefail kills the
  # script here — before the error message below can explain why. That made a
  # missing tag fail the commit with no output at all.
  workflows="$(extract_kv_workflows "$script" || true)"
  if [[ -z "$workflows" ]]; then
    echo "ERROR: $(basename "$script") is missing a '# KV-Workflows:' tag above KV_SECRETS." >&2
    exit_code=1
    continue
  fi

  declared_secrets=()
  while IFS= read -r name; do
    [[ -n "$name" ]] && declared_secrets+=("$name")
  done < <(extract_kv_secrets "$script" | sort -u)

  required_secrets=()
  for wf in $workflows; do
    # Recorded before the existence check: a tag naming a missing file is
    # invariant 2's problem, and double-reporting it as untagged would be noise.
    all_tagged_workflows+=("$wf")
    wf_path="$WORKFLOW_DIR/$wf"
    if [[ ! -f "$wf_path" ]]; then
      echo "ERROR: $(basename "$script") references workflow '$wf' which does not exist." >&2
      exit_code=1
      continue
    fi
    while IFS= read -r name; do
      [[ -n "$name" ]] && required_secrets+=("$name")
    done < <(extract_workflow_secret_names "$wf_path")
    remind_if_new_secret "$wf_path"
  done

  sorted_required_secrets=()
  while IFS= read -r name; do
    [[ -n "$name" ]] && sorted_required_secrets+=("$name")
  done < <(printf '%s\n' "${required_secrets[@]:-}" | sort -u)
  required_secrets=("${sorted_required_secrets[@]:-}")

  missing=()
  for name in "${required_secrets[@]}"; do
    [[ -z "$name" ]] && continue
    if ! printf '%s\n' "${declared_secrets[@]:-}" | grep -qx "$name"; then
      missing+=("$name")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    echo "ERROR: $(basename "$script") is missing KV_SECRETS entries for: ${missing[*]}" >&2
    echo "       These are read by [$workflows] but not granted by this runbook." >&2
    echo "       Add them to KV_SECRETS, then run this runbook (TARGET=main/branch/all)." >&2
    exit_code=1
  fi
done

# Invariant 4 — coverage. Anchored on workflows because a workflow that no
# runbook tags cannot be reached from the runbook walk above.
for wf_path in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
  [[ -f "$wf_path" ]] || continue

  secrets_read="$(extract_workflow_secret_names "$wf_path" || true)"
  [[ -n "$secrets_read" ]] || continue

  wf_name="$(basename "$wf_path")"
  if printf '%s\n' "${all_tagged_workflows[@]:-}" | grep -qx "$wf_name"; then
    continue
  fi

  echo "" >&2
  echo "ERROR: $wf_name reads Key Vault secrets but no runbook grants access to them." >&2
  echo "       Secrets read: $(echo "$secrets_read" | sort -u | tr '\n' ' ')" >&2
  echo "       No file in ops/scripts/utility/federated-credentials/ names this" >&2
  echo "       workflow in its '# KV-Workflows:' tag, so nothing grants its identity" >&2
  echo "       access and every read will fail at deploy time with ForbiddenByRbac." >&2
  echo "       Add '$wf_name' to the tag of the runbook for this workflow's identity," >&2
  echo "       add the secrets to that runbook's KV_SECRETS, then run it with" >&2
  echo "       TARGET=main and TARGET=branch." >&2
  exit_code=1
done

exit "$exit_code"
