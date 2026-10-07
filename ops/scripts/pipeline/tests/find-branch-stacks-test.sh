#!/usr/bin/env bash
# Mocked-CLI test harness for ops/scripts/pipeline/_find-branch-stacks.sh (CAMS-884).
#
# WHY THIS EXISTS
# _find-branch-stacks.sh is the single query shared by `check`'s discovery,
# `check`'s single-target lookup, and `assert-clean-state`'s post-cleanup
# verification in azure-remove-branch.yml. On 2026-10-06 `assert-clean-state`
# failed with an opaque "jq: invalid JSON text passed to --argjson" and no
# retry-warning logged at all: `az stack group list` exited 0 but printed
# something that was not valid JSON (e.g. a one-time preview/extension
# notice landing on stdout instead of stderr), and the then-current retry
# loop only retried on a non-zero exit code. This harness pins the fix: a
# clean exit with non-JSON stdout must be retried like any other transient
# failure, and a persistently-bad response must fail with the offending
# output visible, not a bare jq parse error.
#
# HOW IT WORKS
# Same approach as kv-to-env-test.sh: no network, no Azure, no bats. `az` is
# shadowed by a stub script in a temp dir prepended to PATH, driven by a
# file-based call counter so each case can vary its response across
# retries. Each case runs in its OWN `bash` process under
# `set -euo pipefail`, same as every real `run:` block, because the defect
# this harness pins IS a `set -e` abort.
set -uo pipefail

# Not `set -e`: this harness's whole job is to run code that fails and keep
# going. Failures are checked explicitly, case by case.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="${SCRIPT_DIR}/../_find-branch-stacks.sh"

if [[ ! -f "${HELPER}" ]]; then
  echo "ERROR: helper under test not found at ${HELPER}." >&2
  echo "If _find-branch-stacks.sh moved, re-point HELPER above rather than skipping the tests." >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

# ---------------------------------------------------------------------------
# Stub
# ---------------------------------------------------------------------------

# The `az` stub reads one response per call from a per-case response queue
# directory, in order, so a case can script exactly what each successive
# retry attempt sees. It no-ops `sleep` via the same stub dir so retry-backoff
# cases don't actually wait.
STUB_BIN="${WORK_DIR}/stub-bin"
mkdir -p "${STUB_BIN}"

cat >"${STUB_BIN}/sleep" <<'STUB_SLEEP'
#!/bin/sh
exit 0
STUB_SLEEP
chmod +x "${STUB_BIN}/sleep"

# az_responses_dir is set per-case; the stub consumes out.1/rc.1/err.1,
# out.2/rc.2/err.2, ... in order, repeating the highest-numbered one once the
# queue runs out so a case need not script more attempts than it expects to
# be consumed.
cat >"${STUB_BIN}/az" <<'STUB_AZ'
#!/bin/sh
n_file="${AZ_RESPONSES_DIR}/.callcount"
n=0
[ -f "${n_file}" ] && n=$(cat "${n_file}")
n=$((n + 1))
echo "${n}" >"${n_file}"

if [ ! -f "${AZ_RESPONSES_DIR}/out.${n}" ]; then
  n="${AZ_RESPONSES_DIR}/.maxqueued"
  n=$(cat "${n}")
fi

rc=0
[ -f "${AZ_RESPONSES_DIR}/rc.${n}" ] && rc=$(cat "${AZ_RESPONSES_DIR}/rc.${n}")

cat "${AZ_RESPONSES_DIR}/out.${n}"
[ -f "${AZ_RESPONSES_DIR}/err.${n}" ] && cat "${AZ_RESPONSES_DIR}/err.${n}" >&2
exit "${rc}"
STUB_AZ
chmod +x "${STUB_BIN}/az"

# ---------------------------------------------------------------------------
# Case runner
# ---------------------------------------------------------------------------

CASE_RC=0
CASE_STDOUT=''
CASE_STDERR=''
COMBINED_TEXT=''
AZ_RESPONSES_DIR=''

TMP_SEQ=0
function next_tmp() {
  TMP_SEQ=$((TMP_SEQ + 1))
  printf '%s/%s.%d' "${WORK_DIR}" "$1" "${TMP_SEQ}"
}

# new_responses_dir -- sets AZ_RESPONSES_DIR to a fresh, empty response queue.
# Uses mktemp directly rather than next_tmp: next_tmp's counter increments
# inside a `$(...)` subshell, so it never advances in the caller, and every
# case would otherwise share the literal same directory (and its leftover
# .callcount) as every other case.
function new_responses_dir() {
  AZ_RESPONSES_DIR="$(mktemp -d "${WORK_DIR}/az-responses.XXXXXX")"
}

# queue_response <n> <rc> -- attempt <n>'s exit code; stdin is its stdout.
function queue_response() {
  local n=$1 rc=$2
  cat >"${AZ_RESPONSES_DIR}/out.${n}"
  echo "${rc}" >"${AZ_RESPONSES_DIR}/rc.${n}"
  echo "${n}" >"${AZ_RESPONSES_DIR}/.maxqueued"
}

# queue_stderr <n> -- attempt <n>'s stderr; stdin is its content.
function queue_stderr() {
  local n=$1
  cat >"${AZ_RESPONSES_DIR}/err.${n}"
}

# run_helper <body> -- sources the helper in a fresh `bash -c` under
# `set -euo pipefail` and runs <body> against it.
function run_helper() {
  local body=$1
  local caseDir
  caseDir="$(next_tmp case)"
  mkdir -p "${caseDir}"
  CASE_STDOUT="${caseDir}/stdout"
  CASE_STDERR="${caseDir}/stderr"

  PATH="${STUB_BIN}:${PATH}" \
  AZ_RESPONSES_DIR="${AZ_RESPONSES_DIR}" \
    bash -c "set -euo pipefail; source '${HELPER}'; ${body}" \
    >"${CASE_STDOUT}" 2>"${CASE_STDERR}"
  CASE_RC=$?

  COMBINED_TEXT="$(cat "${CASE_STDOUT}" "${CASE_STDERR}")"
}

function call_count() {
  cat "${AZ_RESPONSES_DIR}/.callcount" 2>/dev/null || echo 0
}

# ---------------------------------------------------------------------------
# Assertions
# ---------------------------------------------------------------------------

CASE_FAILURES=()

function note_failure() {
  CASE_FAILURES+=("$1")
}

function assert_rc() {
  local want=$1
  if [[ "${CASE_RC}" -ne "${want}" ]]; then
    note_failure "expected return code ${want}, got ${CASE_RC}"
    return 1
  fi
}

function assert_rc_nonzero() {
  if [[ "${CASE_RC}" -eq 0 ]]; then
    note_failure "expected a non-zero return code, got 0 (failure was swallowed)"
    return 1
  fi
}

function assert_stdout() {
  local want=$1 got
  got="$(cat "${CASE_STDOUT}")"
  if [[ "${got}" != "${want}" ]]; then
    note_failure "expected stdout '${want}', got '${got}'"
    return 1
  fi
}

function assert_output_contains() {
  local want=$1
  if [[ "${COMBINED_TEXT}" != *"${want}"* ]]; then
    note_failure "expected output to contain '${want}'; output was: $(tr '\n' '|' <<<"${COMBINED_TEXT}")"
    return 1
  fi
}

function assert_call_count() {
  local want=$1 got
  got="$(call_count)"
  if [[ "${got}" -ne "${want}" ]]; then
    note_failure "expected ${want} az call(s), got ${got}"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------

CASE_IDS=()
CASE_RESULTS=()
CASE_DETAILS=()

function run_test_case() {
  local id=$1 fn=$2
  CASE_FAILURES=()
  "${fn}"
  local detail=''
  local result='PASS'
  if [[ "${#CASE_FAILURES[@]}" -gt 0 ]]; then
    result='FAIL'
    detail="$(printf '%s\n' "${CASE_FAILURES[@]}" | paste -sd '|' - | sed 's/|/ | /g')"
  fi
  CASE_IDS+=("${id}")
  CASE_RESULTS+=("${result}")
  CASE_DETAILS+=("${detail}")
}

# --- clean success: merges network + app RG results -------------------------
function case_merges_network_and_app() {
  new_responses_dir
  queue_response 1 0 <<'EOF'
[{"name":"a-network","branchName":"foo","branchHashId":"010f93"}]
EOF
  queue_response 2 0 <<'EOF'
[{"name":"a-app","branchName":"foo","branchHashId":"010f93"}]
EOF
  # shellcheck disable=SC2016 # REASON: this is a script body for the child bash; ${out} must expand there, not here
  run_helper 'find_branch_stacks out net-rg app-rg; printf "%s" "${out}"'
  assert_rc 0
  assert_stdout '[{"name":"a-network","branchName":"foo","branchHashId":"010f93"},{"name":"a-app","branchName":"foo","branchHashId":"010f93"}]'
  assert_call_count 2
}

# --- retries on a non-zero exit (pre-existing behavior) ---------------------
function case_retries_on_nonzero_exit() {
  new_responses_dir
  queue_response 1 1 <<'EOF'
EOF
  echo 'ERROR: (429) Too many requests' | queue_stderr 1
  queue_response 2 0 <<'EOF'
[]
EOF
  run_helper '_fbs_list_with_retry rg "tags.isBranchDeployment == '"'"'true'"'"'"'
  assert_rc 0
  assert_stdout '[]'
  assert_call_count 2
  assert_output_contains 'Too many requests'
}

# --- CAMS-884: exit 0 but non-JSON stdout is retried, not trusted -----------
# This is the actual failure shape from 2026-10-06: az exited 0 with a
# non-JSON notice on stdout, and the old retry loop only checked the exit
# code, so it fed garbage straight to the caller's `jq --argjson` and the
# whole step died with an opaque parse error two calls later.
function case_retries_on_clean_exit_bad_json() {
  new_responses_dir
  queue_response 1 0 <<'EOF'
Command group 'stack' is in preview and under development.
[{"name":"a-network","branchName":"foo","branchHashId":"010f93"}]
EOF
  queue_response 2 0 <<'EOF'
[{"name":"a-network","branchName":"foo","branchHashId":"010f93"}]
EOF
  run_helper '_fbs_list_with_retry rg "tags.isBranchDeployment == '"'"'true'"'"'"'
  assert_rc 0
  assert_stdout '[{"name":"a-network","branchName":"foo","branchHashId":"010f93"}]'
  assert_call_count 2
  # The warning must make the bad response visible, not just say "it failed".
  assert_output_contains 'not valid JSON'
  assert_output_contains "preview and under development"
}

# --- persistently bad JSON fails closed with the offending output visible ---
function case_persistent_bad_json_fails_with_diagnostic() {
  new_responses_dir
  queue_response 1 0 <<'EOF'
not json at all
EOF
  run_helper '_fbs_list_with_retry rg "tags.isBranchDeployment == '"'"'true'"'"'"'
  assert_rc_nonzero
  assert_call_count 3
  assert_output_contains 'not valid JSON'
  assert_output_contains 'not json at all'
}

# --- persistent non-zero exit still fails closed after the retry budget ----
function case_persistent_failure_exhausts_retries() {
  new_responses_dir
  queue_response 1 1 <<'EOF'
EOF
  echo 'ERROR: (403) Forbidden' | queue_stderr 1
  run_helper '_fbs_list_with_retry rg "tags.isBranchDeployment == '"'"'true'"'"'"'
  assert_rc_nonzero
  assert_call_count 3
  assert_output_contains 'Forbidden'
}

run_test_case merges_network_and_app               case_merges_network_and_app
run_test_case retries_on_nonzero_exit               case_retries_on_nonzero_exit
run_test_case retries_on_clean_exit_bad_json        case_retries_on_clean_exit_bad_json
run_test_case persistent_bad_json_fails_with_diagnostic case_persistent_bad_json_fails_with_diagnostic
run_test_case persistent_failure_exhausts_retries   case_persistent_failure_exhausts_retries

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo "_find-branch-stacks.sh mocked-CLI tests"
echo "========================================"

passCount=0
failCount=0

for i in "${!CASE_IDS[@]}"; do
  id="${CASE_IDS[i]}"
  result="${CASE_RESULTS[i]}"
  detail="${CASE_DETAILS[i]}"
  if [[ "${result}" == "PASS" ]]; then
    printf 'PASS   %s\n' "${id}"
    passCount=$((passCount + 1))
  else
    printf 'FAIL   %s\n' "${id}"
    printf '         %s\n' "${detail}"
    failCount=$((failCount + 1))
  fi
done

echo
printf '%d passed, %d failed\n' "${passCount}" "${failCount}"

if [[ "${failCount}" -gt 0 ]]; then
  exit 1
fi
