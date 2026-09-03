#!/usr/bin/env bash
# Mocked-CLI test harness for ops/scripts/pipeline/_kv-to-env.sh (CAMS-760).
#
# WHY THIS EXISTS
# _kv-to-env.sh is the single chokepoint through which every Key Vault secret
# reaches GITHUB_ENV across 24 call sites in .github/workflows. Its failure mode
# is silent: a secret that is empty, half-masked, or percent-mangled does not
# break the build, it just leaks or quietly defaults. Nothing in CI exercises it
# -- the only way to observe a regression today is to read a production log
# after the fact. So it gets a real test seam.
#
# HOW IT WORKS
# No network, no Azure, no bats (this repo has no bats and this harness
# deliberately adds no dependency). `az` and, for one case, `openssl` are
# shadowed by stub scripts in a temp dir prepended to PATH. Each case runs in
# its OWN `bash` process under `set -euo pipefail` -- the same shell options
# every real `run:` block uses -- because several defects here manifest AS a
# set -e abort, which a same-process test could not observe without dying too.
#
# Each case asserts on all three of the helper's observable outputs:
#   1. the return code seen by the caller,
#   2. the ::add-mask:: lines emitted to stdout (what the runner redacts),
#   3. the bytes actually written to the GITHUB_ENV file.
#
# EXPECTED FAILURES
# This harness was written RED-first: the cases in EXPECTED_FAILURES below fail
# against today's _kv-to-env.sh and describe defects tracked by cams-3bzk8.
# They are listed, not omitted, so the list itself is the punch list -- each
# entry must be deleted as its fix lands. A case that is listed but PASSES is
# reported as XPASS with the exact line to remove.
#
# Exit code: non-zero if any case that is NOT in EXPECTED_FAILURES fails.
# XFAIL and XPASS do not fail the run; an unlisted failure is a regression.
set -uo pipefail

# Not `set -e`: this harness's whole job is to run code that fails and keep
# going. Failures are checked explicitly, case by case.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="${SCRIPT_DIR}/../_kv-to-env.sh"

# Cases known to fail against today's helper, tracked by cams-3bzk8. Each entry
# is "case_id # one-line description of the defect".
EXPECTED_FAILURES=()

if [[ ! -f "${HELPER}" ]]; then
  echo "ERROR: helper under test not found at ${HELPER}." >&2
  echo "If _kv-to-env.sh moved, re-point HELPER above rather than skipping the tests." >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------

# The `az` stub takes its behaviour from the environment so each case can drive
# it without rewriting the file. stdout comes from a FILE, not a variable, so a
# case can specify exact bytes (embedded newlines, a bare CR) without any
# quoting or trailing-newline ambiguity.
STUB_BIN="${WORK_DIR}/stub-bin"
mkdir -p "${STUB_BIN}"
# POSIX sh with a direct shebang, not `env bash`: this runs once per case and
# every saved exec shows up in the suite's wall time.
cat >"${STUB_BIN}/az" <<'STUB_AZ'
#!/bin/sh
if [ -n "${STUB_AZ_STDERR:-}" ]; then
  printf '%s\n' "${STUB_AZ_STDERR}" >&2
fi
if [ -n "${STUB_AZ_STDOUT_FILE:-}" ] && [ -f "${STUB_AZ_STDOUT_FILE}" ]; then
  cat "${STUB_AZ_STDOUT_FILE}"
fi
exit "${STUB_AZ_RC:-0}"
STUB_AZ
chmod +x "${STUB_BIN}/az"

# A SEPARATE dir, prepended only by the openssl case, so every other case still
# resolves the real openssl and exercises real delimiter randomness.
STUB_OPENSSL_DIR="${WORK_DIR}/stub-openssl"
mkdir -p "${STUB_OPENSSL_DIR}"
cat >"${STUB_OPENSSL_DIR}/openssl" <<'STUB_OPENSSL'
#!/bin/sh
# Mimics openssl being absent from the runner image: the 127 a shell reports
# for a missing command, and nothing on stdout.
echo "openssl: command not found" >&2
exit 127
STUB_OPENSSL
chmod +x "${STUB_OPENSSL_DIR}/openssl"

# ---------------------------------------------------------------------------
# Case runner
# ---------------------------------------------------------------------------

# Populated by run_helper for the assertions that follow it.
CASE_RC=0
CASE_STDOUT=''
CASE_STDERR=''
CASE_COMBINED=''
CASE_ENV_FILE=''
# The ::add-mask:: payloads from stdout, in order, with the prefix stripped.
MASK_LINES=()
# stdout+stderr as one string, for substring assertions.
COMBINED_TEXT=''

# Temp paths come from a counter rather than mktemp: WORK_DIR is already a
# private mktemp -d, so the names inside it need only be unique, and ~60 fewer
# subprocesses keeps the whole suite under a second.
TMP_SEQ=0
function next_tmp() {
  TMP_SEQ=$((TMP_SEQ + 1))
  printf '%s/%s.%d' "${WORK_DIR}" "$1" "${TMP_SEQ}"
}

# run_helper <body>
#
# Sources the helper in a fresh `bash -c` under `set -euo pipefail` and runs
# <body> against it. Reads STUB_AZ_* / EXTRA_PATH from the caller's scope.
function run_helper() {
  local body=$1
  local caseDir
  caseDir="$(next_tmp case)"
  mkdir -p "${caseDir}"
  CASE_ENV_FILE="${caseDir}/github_env"
  CASE_STDOUT="${caseDir}/stdout"
  CASE_STDERR="${caseDir}/stderr"
  CASE_COMBINED="${caseDir}/combined"
  : >"${CASE_ENV_FILE}"

  # `set -euo pipefail` mirrors every real call site. Without it the defects
  # that manifest as a premature abort would not reproduce at all.
  GITHUB_ENV="${CASE_ENV_FILE}" \
  PATH="${EXTRA_PATH:-}${STUB_BIN}:${PATH}" \
  STUB_AZ_RC="${STUB_AZ_RC:-0}" \
  STUB_AZ_STDERR="${STUB_AZ_STDERR:-}" \
  STUB_AZ_STDOUT_FILE="${STUB_AZ_STDOUT_FILE:-}" \
    bash -c "set -euo pipefail; source '${HELPER}'; ${body}" \
    >"${CASE_STDOUT}" 2>"${CASE_STDERR}"
  CASE_RC=$?

  cat "${CASE_STDOUT}" "${CASE_STDERR}" >"${CASE_COMBINED}"

  # Parsed once here so each assertion is a pure in-shell check.
  MASK_LINES=()
  local line
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" == '::add-mask::'* ]] && MASK_LINES+=("${line#'::add-mask::'}")
  done <"${CASE_STDOUT}"
  COMBINED_TEXT="$(<"${CASE_COMBINED}")"
}

# az_stdout <<'EOF' ... EOF  -- exact bytes the az stub will print.
function az_stdout() {
  STUB_AZ_STDOUT_FILE="$(next_tmp azout)"
  cat >"${STUB_AZ_STDOUT_FILE}"
}

function reset_stub() {
  STUB_AZ_RC=0
  STUB_AZ_STDERR=''
  STUB_AZ_STDOUT_FILE=''
  EXTRA_PATH=''
}

# Verbatim shapes of what `az keyvault secret show` actually writes. These are
# not decoration: the helper classifies a failure BY this text, so a case that
# invents its own wording (or, worse, stubs a non-zero exit with EMPTY stderr,
# a shape real az never produces) proves nothing about production behaviour.
#
# az_absent_stderr <secret-name> -- the 404 for a name the vault does not hold.
function az_absent_stderr() {
  printf 'ERROR: (SecretNotFound) A secret with (name/id) %s was not found in this key vault.\nCode: SecretNotFound\nMessage: A secret with (name/id) %s was not found in this key vault.' "$1" "$1"
}

# ---------------------------------------------------------------------------
# Assertions. Each appends to FAILURES and returns non-zero on mismatch.
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

function assert_mask_count() {
  local want=$1
  if [[ "${#MASK_LINES[@]}" -ne "${want}" ]]; then
    note_failure "expected ${want} ::add-mask:: line(s), got ${#MASK_LINES[@]}: $(tr '\n\r' '|^' <"${CASE_STDOUT}")"
    return 1
  fi
}

function assert_mask_line() {
  local want=$1 got i
  # Indexed rather than "${MASK_LINES[@]}" so an empty array is safe under
  # `set -u` on bash 3.2 as well as on the runner's bash 5.
  for ((i = 0; i < ${#MASK_LINES[@]}; i++)); do
    got="${MASK_LINES[i]}"
    [[ "${got}" == "${want}" ]] && return 0
  done
  note_failure "expected mask line '::add-mask::${want}'; stdout was: $(tr '\n\r' '|^' <"${CASE_STDOUT}")"
  return 1
}

function assert_output_contains() {
  local want=$1
  if [[ "${COMBINED_TEXT}" != *"${want}"* ]]; then
    note_failure "expected output to contain '${want}'; output was: $(tr '\n\r' '|^' <"${CASE_COMBINED}")"
    return 1
  fi
}

function assert_output_not_contains() {
  local unwanted=$1
  if [[ "${COMBINED_TEXT}" == *"${unwanted}"* ]]; then
    note_failure "expected output NOT to contain '${unwanted}'; output was: $(tr '\n\r' '|^' <"${CASE_COMBINED}")"
    return 1
  fi
}

function assert_env_file_empty() {
  if [[ -s "${CASE_ENV_FILE}" ]]; then
    note_failure "expected nothing written to GITHUB_ENV; file contained: $(tr '\n' '|' <"${CASE_ENV_FILE}")"
    return 1
  fi
}

# Reconstructs a variable's value from the env file the way the Actions runner
# parses a `NAME<<DELIM` heredoc block, so a case asserts on what the job would
# ACTUALLY see -- not merely that some bytes were appended. Also enforces that
# the delimiter is the randomised EOF_<16 hex> form: a predictable delimiter is
# an env-injection vector, so it is a behaviour under test, not an incidental.
function parse_env_value() {
  local envFile=$1 want=$2 outFile=$3
  local line delim='' capturing=0 first=1
  : >"${outFile}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    if [[ "${capturing}" -eq 1 ]]; then
      if [[ "${line}" == "${delim}" ]]; then
        capturing=0
        continue
      fi
      if [[ "${first}" -eq 1 ]]; then first=0; else printf '\n' >>"${outFile}"; fi
      printf '%s' "${line}" >>"${outFile}"
    elif [[ "${line}" == "${want}<<"* ]]; then
      delim="${line#"${want}<<"}"
      if [[ ! "${delim}" =~ ^EOF_[0-9a-f]{16}$ ]]; then
        note_failure "delimiter '${delim}' is not the randomised EOF_<16 hex> form"
        return 1
      fi
      capturing=1
      first=1
    fi
  done <"${envFile}"
  if [[ "${capturing}" -eq 1 ]]; then
    note_failure "GITHUB_ENV heredoc for '${want}' was never closed by its delimiter"
    return 1
  fi
  if [[ -z "${delim}" ]]; then
    note_failure "no '${want}<<DELIM' block found in GITHUB_ENV: $(tr '\n' '|' <"${envFile}")"
    return 1
  fi
}

# assert_env_value NAME <<'EOF' ... EOF  -- exact expected bytes, no trailing newline.
function assert_env_value() {
  local name=$1 expected actual
  expected="$(next_tmp expected)"
  actual="$(next_tmp actual)"
  cat >"${expected}"
  # The heredoc feeding this function always ends in a newline; the parsed value
  # never does. Strip the single trailing newline so the comparison is on value
  # bytes rather than on heredoc syntax.
  printf '%s' "$(cat "${expected}")" >"${expected}.trimmed"

  parse_env_value "${CASE_ENV_FILE}" "${name}" "${actual}" || return 1
  if ! cmp -s "${expected}.trimmed" "${actual}"; then
    # Newlines and CRs are rendered as | and ^ so a whitespace-only mismatch is visible.
    note_failure "GITHUB_ENV value for ${name} mismatch: expected [$(tr '\n\r' '|^' <"${expected}.trimmed")] got [$(tr '\n\r' '|^' <"${actual}")]"
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
  reset_stub
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

# --- required secret present ------------------------------------------------
function case_required_present() {
  az_stdout <<'EOF'
s3cret-value
EOF
  run_helper 'kv_to_env MY_SECRET my-vault my-secret-name'
  assert_rc 0
  assert_mask_count 1
  assert_mask_line 's3cret-value'
  assert_env_value MY_SECRET <<'EOF'
s3cret-value
EOF
}

# --- required secret missing (az rc != 0) -----------------------------------
# A missing credential must stop the job, not export an empty value. Stubbed
# with the real SecretNotFound diagnostic: az reports a missing secret on
# stderr with a non-zero exit, so a case that stubs rc != 0 with empty stderr
# is not testing the absence path at all.
function case_required_missing() {
  STUB_AZ_RC=3
  STUB_AZ_STDERR="$(az_absent_stderr absent-secret)"
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SECRET my-vault absent-secret'
  assert_rc 1
  assert_env_file_empty
  # Named as a nonexistent secret, not as an unspecified failure: this is the
  # one outcome where "it isn't in the vault" is the correct thing to tell the
  # operator, and the message has to differ from the RBAC/throttling one.
  assert_output_contains "required secret 'absent-secret' does not exist in vault 'my-vault'"
}

# --- optional missing, WITH default -----------------------------------------
# The behaviour the live --optional call sites depend on (SLOT-NAME,
# AZ-FUNCTIONS-PLAN-TYPE, AZ-FUNCTIONS-LOCATION, DEFAULT-NOTIFICATION-RECIPIENT):
# an environment that never opted in must get
# the default and a green deploy, exactly as it did before CAMS-760. Real az
# ALWAYS writes a diagnostic here, so classifying "stderr is non-empty" as a
# fault would make every one of those a hard deploy failure.
function case_optional_missing_with_default() {
  STUB_AZ_RC=3
  STUB_AZ_STDERR="$(az_absent_stderr absent-secret)"
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SETTING my-vault absent-secret --optional fallback-value'
  assert_rc 0
  assert_mask_count 1
  assert_mask_line 'fallback-value'
  assert_env_value MY_SETTING <<'EOF'
fallback-value
EOF
  # A substituted default has to be visible in the log, or a Function App in
  # the wrong region has no explanation in it.
  assert_output_contains 'using the --optional default'
}

# --- optional missing, NO default, via kv_to_env ----------------------------
# `--optional` with no DEFAULT is documented as legal ("using DEFAULT (or empty)
# instead"). An opted-out setting must resolve to empty and let the job continue.
#
# This path passes today, but only by accident, and the accident is worth a test
# of its own. kv_to_env calls `kv_get ... || return 1`; bash suppresses `set -e`
# for every command inside a function invoked as part of an `&&`/`||` list, so
# kv_mask's non-zero return on an empty value is swallowed here. Remove the
# `|| return 1` and this case starts failing too. It is paired with the bare
# kv_get case below, which has no such shield.
function case_optional_missing_no_default_via_kv_to_env() {
  STUB_AZ_RC=3
  STUB_AZ_STDERR="$(az_absent_stderr absent-secret)"
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SETTING my-vault absent-secret --optional'
  assert_rc 0
  assert_env_value MY_SETTING <<'EOF'
EOF
}

# --- optional missing, NO default, bare kv_get ------------------------------
# The same call with kv_get used directly -- the documented API, and how 8 real
# call sites in reusable-deploy.yml, reusable-infrastructure-deploy.yml and
# azure-remove-branch.yml invoke it. Bare, there is no `||` to suppress `set -e`,
# so kv_mask "" returning 1 kills the whole step: no error message, no output
# variable, just a dead job. Asserts the out variable is actually assigned, not
# merely that the shell survived.
function case_optional_missing_no_default() {
  STUB_AZ_RC=3
  STUB_AZ_STDERR="$(az_absent_stderr absent-secret)"
  az_stdout </dev/null
  # shellcheck disable=SC2016 # REASON: this is a script body for the child bash; ${myValue} must expand there, not here
  run_helper 'kv_get myValue my-vault absent-secret --optional; echo "assigned=[${myValue}]"; echo "still running"'
  assert_rc 0
  assert_output_contains 'assigned=[]'
  assert_output_contains 'still running'
}

# --- optional + az exits non-zero -------------------------------------------
# The helper's own comment says a real CLI failure "must surface, not be read as
# 'no value'". With --optional and a default, throttling is indistinguishable
# from an absent secret today: the job silently continues on the default, and
# the CLI's diagnostic is thrown away by 2>/dev/null. That turns a retryable
# infrastructure fault into a wrong-configuration deploy.
function case_optional_az_error_not_conflated() {
  STUB_AZ_RC=1
  STUB_AZ_STDERR='ERROR: (429) Too many requests'
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SETTING my-vault some-secret --optional fallback-value'
  assert_rc_nonzero
  assert_output_contains 'Too many requests'
  assert_env_file_empty
}

# --- required + az exits non-zero with a real CLI message -------------------
# Failing with "not found in vault" when the CLI actually said "Forbidden" sends
# whoever is on call to the wrong problem: the secret exists, the identity's
# RBAC does not. The CLI's message must reach the log.
function case_required_az_error_surfaces_cli_message() {
  STUB_AZ_RC=1
  STUB_AZ_STDERR='ERROR: (Forbidden) Caller not authorized'
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SECRET my-vault some-secret'
  assert_rc_nonzero
  assert_output_contains 'Caller not authorized'
  # And must not ALSO claim the secret is absent: the secret is there, the role
  # assignment is not, and those have different fixes.
  assert_output_not_contains 'does not exist in vault'
}

# --- optional + RBAC denial is FATAL ----------------------------------------
# THE property that must not be lost. A 403 is not an absence, so --optional
# does not cover it: applying the default here would deploy a wrong-but-plausible
# configuration and report success, and the missing role assignment -- the
# actual, fixable fault -- would never be seen. Distinct from
# optional_az_error_not_conflated (throttling) because RBAC is the case that
# was historically mislabelled "not found in vault".
function case_optional_rbac_error_is_fatal() {
  STUB_AZ_RC=1
  STUB_AZ_STDERR='ERROR: (ForbiddenByRbac) Caller is not authorized to perform action on resource. Action: Microsoft.KeyVault/vaults/secrets/getSecret'
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SETTING my-vault some-secret --optional fallback-value'
  assert_rc_nonzero
  assert_output_contains 'ForbiddenByRbac'
  assert_output_not_contains 'does not exist in vault'
  # The default must not have been exported on the way out.
  assert_env_file_empty
  assert_mask_count 0
}

# --- optional + a disabled secret is FATAL ----------------------------------
# SecretDisabled is deliberately NOT classified as absence. The secret exists;
# a human turned it off, which is how a compromised credential gets revoked in
# a hurry. Silently deploying a default over a just-revoked value is the
# opposite of the intent. Pinned as a test because it is a judgement call.
function case_optional_secret_disabled_is_fatal() {
  STUB_AZ_RC=1
  STUB_AZ_STDERR='ERROR: (SecretDisabled) Operation get is not allowed on a disabled secret.'
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SETTING my-vault some-secret --optional fallback-value'
  assert_rc_nonzero
  assert_output_contains 'SecretDisabled'
  assert_env_file_empty
}

# --- optional + a missing VAULT is FATAL ------------------------------------
# A misspelled or torn-down vault is a broken pipeline, not an opted-out
# setting -- the secret's real value may well exist in the vault that was
# meant. Only the secret-scoped SecretNotFound counts as absence, which is why
# the broad "ResourceNotFound" match used by az-delete-branch-resources.sh is
# too coarse to reuse here.
function case_optional_vault_not_found_is_fatal() {
  STUB_AZ_RC=1
  STUB_AZ_STDERR='ERROR: (ResourceNotFound) The Resource '"'"'Microsoft.KeyVault/vaults/kv-typo'"'"' under resource group '"'"'rg'"'"' was not found.'
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SETTING kv-typo some-secret --optional fallback-value'
  assert_rc_nonzero
  assert_output_contains 'ResourceNotFound'
  assert_env_file_empty
}

# --- optional + non-zero exit with NO diagnostic is FATAL -------------------
# Real az always says why it failed, so this shape (az killed mid-flight, a
# wrapper eating stderr) is not an absence -- it is a failure whose cause was
# lost. Absence has a known signature; anything without it has not been SHOWN
# to be absence, so it fails closed rather than defaulting past an unknown
# fault. Deliberate divergence from origin/main, which read a bare non-zero
# exit as absence.
function case_optional_no_diagnostic_is_fatal() {
  STUB_AZ_RC=137
  STUB_AZ_STDERR=''
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SETTING my-vault some-secret --optional fallback-value'
  assert_rc_nonzero
  assert_output_contains 'nothing on stderr'
  assert_env_file_empty
}

# --- absence classification cannot be spoofed by the secret NAME ------------
# az echoes the requested name back inside its diagnostic, so a secret named
# "SecretNotFound" would otherwise make an unrelated 403 read as absence --
# the one direction that must never misfire, because it is the one that
# substitutes a default.
function case_optional_name_cannot_spoof_absence() {
  STUB_AZ_RC=1
  STUB_AZ_STDERR='ERROR: (Forbidden) Caller not authorized on /secrets/SecretNotFound'
  az_stdout </dev/null
  run_helper 'kv_to_env MY_SETTING my-vault SecretNotFound --optional fallback-value'
  assert_rc_nonzero
  assert_output_contains 'Caller not authorized'
  assert_env_file_empty
}

# --- multiline value --------------------------------------------------------
# ::add-mask:: is line-oriented: one mask per line, or every line after the
# first stays in clear.
function case_multiline_value() {
  az_stdout <<'EOF'
-----BEGIN KEY-----
middle-line
-----END KEY-----
EOF
  run_helper 'kv_to_env MY_PEM my-vault pem-secret'
  assert_rc 0
  assert_mask_count 3
  assert_mask_line '-----BEGIN KEY-----'
  assert_mask_line 'middle-line'
  assert_mask_line '-----END KEY-----'
  assert_env_value MY_PEM <<'EOF'
-----BEGIN KEY-----
middle-line
-----END KEY-----
EOF
}

# --- value containing % -----------------------------------------------------
# The runner percent-decodes a workflow command's data before acting on it, so a
# raw % would make it register a mask for a different string than the secret.
function case_percent_in_value() {
  az_stdout <<'EOF'
pa55%word
EOF
  run_helper 'kv_to_env MY_SECRET my-vault pct-secret'
  assert_rc 0
  assert_mask_count 1
  assert_mask_line 'pa55%25word'
  assert_env_value MY_SECRET <<'EOF'
pa55%word
EOF
}

# --- value containing literal %0A / %25 ------------------------------------
# Asserts the round trip, not just the escaping: decoding what was emitted must
# reproduce the secret exactly, or the mask is registered for the wrong bytes.
function case_literal_percent_escapes() {
  az_stdout <<'EOF'
a%0Ab%25c
EOF
  run_helper 'kv_to_env MY_SECRET my-vault escape-secret'
  assert_rc 0
  assert_mask_count 1
  assert_mask_line 'a%250Ab%2525c'
  # What the runner would decode the emitted mask back into.
  local decoded
  decoded="${MASK_LINES[0]//%25/%}"
  if [[ "${decoded}" != 'a%0Ab%25c' ]]; then
    note_failure "runner would decode the mask to '${decoded}', not the secret 'a%0Ab%25c'"
  fi
  assert_env_value MY_SECRET <<'EOF'
a%0Ab%25c
EOF
}

# --- value with a trailing CR (CRLF secret) ---------------------------------
# A secret pasted from Windows keeps its CR. An unescaped CR in a workflow
# command truncates the line the runner sees.
function case_trailing_cr() {
  # Written with printf rather than a heredoc so the CR is unambiguous: this is
  # exactly what `az ... -o tsv` puts on stdout for a CRLF secret.
  az_stdout < <(printf 'secret-with-cr\r\n')
  run_helper 'kv_to_env MY_SECRET my-vault cr-secret'
  assert_rc 0
  assert_mask_count 1
  assert_mask_line 'secret-with-cr%0D'
  printf 'secret-with-cr\r' >"${WORK_DIR}/cr-expected"
  local actual="${WORK_DIR}/cr-actual"
  if parse_env_value "${CASE_ENV_FILE}" MY_SECRET "${actual}"; then
    if ! cmp -s "${WORK_DIR}/cr-expected" "${actual}"; then
      note_failure "CR not preserved through the env write: got [$(tr '\r' '^' <"${actual}")]"
    fi
  fi
}

# --- reserved _kv_ prefix ---------------------------------------------------
function case_reserved_prefix() {
  az_stdout <<'EOF'
whatever
EOF
  run_helper 'kv_get _kv_foo my-vault my-secret'
  assert_rc 2
}

# --- kv_mask "" -------------------------------------------------------------
# kv_mask is called unconditionally by kv_get, so a non-zero return on an empty
# value aborts any caller running under `set -e` -- which is all of them. Empty
# is a legitimate value for an opted-out optional setting; masking nothing is a
# no-op, not an error.
function case_kv_mask_empty_returns_zero() {
  run_helper 'kv_mask ""'
  assert_rc 0
  assert_mask_count 0
}

# --- openssl unavailable ----------------------------------------------------
# kv_write_env already has a guard for a bad delimiter, but it is unreachable:
# `delimiter="EOF_$(openssl ...)"` takes the substitution's exit status, so
# `set -e` aborts the function before the regex is ever evaluated. The operator
# sees a bare non-zero exit with no explanation.
function case_openssl_failure_reports_clear_error() {
  EXTRA_PATH="${STUB_OPENSSL_DIR}:"
  az_stdout <<'EOF'
some-value
EOF
  run_helper 'kv_to_env MY_SECRET my-vault my-secret'
  assert_rc_nonzero
  assert_output_contains 'ERROR:'
  assert_output_contains 'delimiter'
}

run_test_case required_present                        case_required_present
run_test_case required_missing                        case_required_missing
run_test_case optional_missing_with_default           case_optional_missing_with_default
run_test_case optional_missing_no_default_via_kv_to_env case_optional_missing_no_default_via_kv_to_env
run_test_case optional_missing_no_default             case_optional_missing_no_default
run_test_case optional_az_error_not_conflated         case_optional_az_error_not_conflated
run_test_case required_az_error_surfaces_cli_message  case_required_az_error_surfaces_cli_message
run_test_case optional_rbac_error_is_fatal            case_optional_rbac_error_is_fatal
run_test_case optional_secret_disabled_is_fatal       case_optional_secret_disabled_is_fatal
run_test_case optional_vault_not_found_is_fatal       case_optional_vault_not_found_is_fatal
run_test_case optional_no_diagnostic_is_fatal         case_optional_no_diagnostic_is_fatal
run_test_case optional_name_cannot_spoof_absence      case_optional_name_cannot_spoof_absence
run_test_case multiline_value                         case_multiline_value
run_test_case percent_in_value                        case_percent_in_value
run_test_case literal_percent_escapes                 case_literal_percent_escapes
run_test_case trailing_cr                             case_trailing_cr
run_test_case reserved_prefix                         case_reserved_prefix
run_test_case kv_mask_empty_returns_zero              case_kv_mask_empty_returns_zero
run_test_case openssl_failure_reports_clear_error     case_openssl_failure_reports_clear_error

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

function is_expected_failure() {
  local id=$1 entry
  # Expanded via the ${a[@]+"${a[@]}"} guard so an EMPTY array is not an unbound
  # variable under `set -u` on bash 3.2 -- stock macOS bash, which devs run this
  # hook on. Same guard as assert_mask_line. Once every defect is fixed the array
  # IS empty, so the plain expansion breaks precisely when the suite is green.
  for entry in ${EXPECTED_FAILURES[@]+"${EXPECTED_FAILURES[@]}"}; do
    [[ "${entry}" == "${id}" ]] && return 0
  done
  return 1
}

echo "_kv-to-env.sh mocked-CLI tests"
echo "=============================="

passCount=0
xfailCount=0
xpassCount=0
regressionCount=0
xpassIds=()

for i in "${!CASE_IDS[@]}"; do
  id="${CASE_IDS[i]}"
  result="${CASE_RESULTS[i]}"
  detail="${CASE_DETAILS[i]}"
  if [[ "${result}" == "PASS" ]]; then
    if is_expected_failure "${id}"; then
      printf 'XPASS  %s\n' "${id}"
      xpassCount=$((xpassCount + 1))
      xpassIds+=("${id}")
    else
      printf 'PASS   %s\n' "${id}"
      passCount=$((passCount + 1))
    fi
  else
    if is_expected_failure "${id}"; then
      printf 'XFAIL  %s\n' "${id}"
      printf '         known defect (cams-3bzk8): %s\n' "${detail}"
      xfailCount=$((xfailCount + 1))
    else
      printf 'FAIL   %s\n' "${id}"
      printf '         %s\n' "${detail}"
      regressionCount=$((regressionCount + 1))
    fi
  fi
done

echo
printf '%d passed, %d known-failing (XFAIL), %d unexpectedly passing (XPASS), %d regressions\n' \
  "${passCount}" "${xfailCount}" "${xpassCount}" "${regressionCount}"

if [[ "${xfailCount}" -gt 0 ]]; then
  echo
  echo "Known failures tracked by cams-3bzk8 -- delete each from EXPECTED_FAILURES"
  echo "in this file as its fix lands. The list must end up empty:"
  for entry in "${EXPECTED_FAILURES[@]}"; do
    printf '  - %s\n' "${entry}"
  done
fi

if [[ "${xpassCount}" -gt 0 ]]; then
  echo
  echo "The following cases now PASS but are still listed as expected failures."
  echo "Remove these lines from EXPECTED_FAILURES in ${BASH_SOURCE[0]#"${PWD}"/}:"
  for entry in "${xpassIds[@]}"; do
    printf '  "%s"\n' "${entry}"
  done
fi

if [[ "${regressionCount}" -gt 0 ]]; then
  echo
  echo "ERROR: ${regressionCount} case(s) that are expected to pass are failing." >&2
  exit 1
fi
