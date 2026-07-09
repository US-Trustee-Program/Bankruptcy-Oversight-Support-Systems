#!/usr/bin/env bash
# Pre-commit hook: keep each federated-credential runbook's KV_SECRETS array
# in sync with the Key Vault secrets its tagged workflow(s) actually read.
#
# For every ops/scripts/utility/federated-credentials/setup-*-federated-credential.sh:
#   1. Read its "# KV-Workflows: <file>[,<file>]" tag.
#   2. Collect every "az keyvault secret show --name X" reference from those
#      workflow file(s).
#   3. Fail the commit if any referenced secret is missing from KV_SECRETS —
#      that gap means the deploy identity was never granted access to it.
#   4. If a workflow file changed in this commit and it references a secret
#      name that did not exist at HEAD, print a reminder (non-blocking): the
#      secret still needs to be created in Key Vault and the runbook re-run.
#      Neither this hook nor any local check can confirm that against Azure.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RUNBOOK_DIR="$REPO_ROOT/ops/scripts/utility/federated-credentials"
WORKFLOW_DIR="$REPO_ROOT/.github/workflows"

exit_code=0

extract_kv_secrets() {
  sed -n '/^KV_SECRETS=(/,/)/p' "$1" | grep -oE '"[A-Z0-9-]+"' | tr -d '"'
}

extract_kv_workflows() {
  grep -m1 '^# KV-Workflows:' "$1" | sed 's/^# KV-Workflows: *//' | tr ',' ' '
}

extract_workflow_secret_names() {
  grep -E 'keyvault secret show' "$1" | grep -oE -- '--name [A-Z0-9-]+' | awk '{print $2}'
}

remind_if_new_secret() {
  local wf_path="$1" rel added
  rel="${wf_path#"$REPO_ROOT"/}"
  git cat-file -e "HEAD:$rel" 2>/dev/null || return 0

  added=$(comm -13 \
    <(git show "HEAD:$rel" | grep -E 'keyvault secret show' | grep -oE -- '--name [A-Z0-9-]+' | awk '{print $2}' | sort -u) \
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

for script in "$RUNBOOK_DIR"/setup-*-federated-credential.sh; do
  [[ -f "$script" ]] || continue

  workflows="$(extract_kv_workflows "$script")"
  if [[ -z "$workflows" ]]; then
    echo "ERROR: $(basename "$script") is missing a '# KV-Workflows:' tag above KV_SECRETS." >&2
    exit_code=1
    continue
  fi

  mapfile -t declared_secrets < <(extract_kv_secrets "$script" | sort -u)

  required_secrets=()
  for wf in $workflows; do
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

  mapfile -t required_secrets < <(printf '%s\n' "${required_secrets[@]:-}" | sort -u)

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

exit "$exit_code"
