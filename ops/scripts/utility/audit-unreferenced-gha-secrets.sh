#!/usr/bin/env bash

# Read-only audit of the GitHub Actions secrets and variables slated for
# deletion by the CAMS-760 cleanup (cams-9n4tg).
#
# Recomputes the "is anything still referencing this?" check from the working
# tree rather than trusting the list in the runbook.
#
# DESIGN RULE: a gate that cannot run reports ERROR, never OK. Every external
# command's exit status is checked, because the dangerous failure here is not a
# crash -- it is a gate that finds nothing because it never really looked, and
# prints a green light over an irreversible deletion.
#
# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/audit-unreferenced-gha-secrets.sh [-b|h]
#
# Exit codes
#   0  pass (no findings, or findings that are warnings only)
#   1  a deletion target is still referenced on this ref -- do not delete
#   2  usage error / not run from the repository root
#   3  inconclusive -- a gate could not run
#   4  STRICT=true and at least one warning was raised

set -uo pipefail

Help() {
  echo "Audits the GitHub Actions secrets/variables slated for deletion by CAMS-760."
  echo "Read-only: this script never deletes anything."
  echo
  echo "Syntax: ./ops/scripts/utility/audit-unreferenced-gha-secrets.sh [-b|h]"
  echo "options:"
  echo "b     Also scan every remote branch, not just open PRs. Slow."
  echo "h     Print this Help and exit."
  echo
  echo "environment:"
  echo "GH_REPO   owner/repo to audit. Defaults to the US-Trustee-Program repo."
  echo "          Set this when 'git' cannot resolve the remote."
  echo "STRICT    'true' makes any warning exit 4 instead of 0."
  echo
  echo "exit codes: 0 pass  1 still-referenced  2 usage  3 inconclusive  4 strict"
  echo
}

SCAN_ALL_BRANCHES=0
while getopts ":bh" opt; do
  case "${opt}" in
    b) SCAN_ALL_BRANCHES=1 ;;
    h) Help; exit 0 ;;
    *) Help; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
if [[ $# -gt 0 ]]; then
  echo "ERROR: unexpected argument: $1" >&2
  Help
  exit 2
fi

# Resolved explicitly rather than via gh's :owner/:repo placeholder, which
# shells out to git and fails opaquely when git is unavailable.
REPO="${GH_REPO:-US-Trustee-Program/Bankruptcy-Oversight-Support-Systems}"

# Tier A -- value is preserved in Key Vault or is now a hardcoded literal.
TIER_A_SECRETS=(
  AZURE_CREDENTIALS ANALYTICS_WORKSPACE_ID AZ_APP_RG AZ_NETWORK_RG AZURE_RG
  AZ_ANALYTICS_RG AZ_PRIVATE_DNS_ZONE_ID AZ_PRIVATE_DNS_ZONE_RG
  AZ_STOR_VERACODE_KEY AZ_STOR_VERACODE_NAME CAMS_REACT_SELECT_HASH
  MSSQL_DATABASE_DXTR MSSQL_HOST MSSQL_TRUST_UNSIGNED_CERT MSSQL_USER
  ADMIN_KEY SNYK_OAUTH_CLIENT_ID SNYK_OAUTH_CLIENT_SECRET
)
TIER_A_VARS=(AZ_HOSTNAME_SUFFIX AZ_PRIVATE_DNS_ZONE)

# Tier B -- no Key Vault counterpart. Deleting loses the value irreversibly.
TIER_B_SECRETS=(
  LD_ACCESS_TOKEN PGP_SIGNING_PASSPHRASE
  VERACODE_API_ID VERACODE_API_KEY VERACODE_APP_ID VERACODE_SAST_POLICY
  SRCCLR_API_TOKEN SRCCLR_REGION
)

# Tier C -- variables, values recoverable before deletion.
TIER_C_VARS=(NODE_VERSION SLOT_NAME STARTING_MONTH)

ALL=("${TIER_A_SECRETS[@]}" "${TIER_A_VARS[@]}" "${TIER_B_SECRETS[@]}" "${TIER_C_VARS[@]}")

failures=0
warnings=0
errors=0

fail() { echo "  FAIL  $*"; failures=$((failures + 1)); }
warn() { echo "  WARN  $*"; warnings=$((warnings + 1)); }
err()  { echo "  ERROR $*"; errors=$((errors + 1)); }
ok()   { echo "  OK    $*"; }
indent() { while IFS= read -r line; do echo "        ${line}"; done; }

if [[ ! -d .github ]]; then
  echo "ERROR: run this from the repository root (no .github directory here)." >&2
  exit 2
fi

# GitHub Actions expression property access is CASE-INSENSITIVE, so
# `${{ secrets.azure_rg }}` is a working reference to AZURE_RG. Whitespace is
# also permitted around the dot. Both must be matched or the gate reports a
# live reference as clean.
#
# Symlinked subdirectories are walked via `find -L` rather than `grep -R`:
# BSD grep (what this script actually gets -- `grep` is commonly a zsh alias to
# something else interactively, which masks this) does NOT follow a symlinked
# directory found during the walk, and returns "no match" while having searched
# nothing.
#
# Any message on stderr -- an unreadable file, a symlink loop -- is treated as a
# hard error rather than folded into "no match", because grep's rc>=2 is
# otherwise indistinguishable from clean once the output is captured.
#
# The file set is enumerated ONCE by scan_prepare, in the parent shell, so that
# an unreadable file is reported once as its own error instead of poisoning all
# 31 per-name scans. (ref_grep runs inside a command substitution, so it cannot
# report errors back through a variable -- a subshell assignment is lost.)
SCAN_FILES=()
SCAN_UNREADABLE=()
scan_prepare() {  # scan_prepare <path>
  local path="$1" f
  SCAN_FILES=()
  SCAN_UNREADABLE=()
  while IFS= read -r f; do
    [[ -z "${f}" ]] && continue
    if [[ -r "${f}" ]]; then SCAN_FILES+=("${f}"); else SCAN_UNREADABLE+=("${f}"); fi
  done < <(find -L "${path}" -type f 2>/dev/null)
}

# Returns: 0 match (prints hits), 1 no match.
ref_grep() {  # ref_grep <NAME>
  [[ ${#SCAN_FILES[@]} -eq 0 ]] && return 1
  grep -HinE "(secrets|vars)[[:space:]]*\.[[:space:]]*${1}([^A-Za-z0-9_]|\$)" \
    "${SCAN_FILES[@]}" 2>/dev/null
}

urlencode() {
  local s="$1" o="" c
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "${c}" in
      [a-zA-Z0-9.~_-]) o+="${c}" ;;
      *) o+=$(printf '%%%02X' "'${c}") ;;
    esac
  done
  printf '%s' "${o}"
}

echo "=============================================================="
echo " CAMS-760 unreferenced GHA secret/variable audit"
echo " repo: ${REPO}"
echo " ${#ALL[@]} planned deletion targets"
echo "=============================================================="
echo

# --- Preflight --------------------------------------------------------------
echo "--- Preflight ---"

# Gate 1's whole value is that a match means "still referenced". A grep that
# silently fails to match turns Gate 1 into a false PASS -- the single most
# dangerous outcome here. Prove the pattern works through THE SAME ENTRY POINT
# Gate 1 uses: ref_grep against a DIRECTORY, including a nested symlinked
# subdirectory, covering every reference style GitHub actually accepts.
SELF_TEST_OK=0
SELF_TEST_DIR=$(mktemp -d) || {
  echo "ERROR: mktemp failed; cannot run the self-test." >&2
  exit 3
}
trap '[[ -n "${SELF_TEST_DIR:-}" ]] && rm -rf "${SELF_TEST_DIR}"' EXIT

# shellcheck disable=SC2016  # ${{ }} are GitHub Actions literals, not shell expansions
{
  mkdir -p "${SELF_TEST_DIR}/tree/nested" "${SELF_TEST_DIR}/elsewhere" "${SELF_TEST_DIR}/neg"
  printf 'a: ${{ secrets.AUDIT_SELFTEST }}\n'   > "${SELF_TEST_DIR}/tree/upper.yml"
  printf 'b: ${{ secrets.audit_selftest }}\n'   > "${SELF_TEST_DIR}/tree/lower.yml"
  printf 'c: ${{ secrets . AUDIT_SELFTEST }}\n' > "${SELF_TEST_DIR}/tree/spaced.yml"
  printf 'd: ${{ vars.AUDIT_SELFTEST }}\n'      > "${SELF_TEST_DIR}/tree/vars.yml"
  printf 'e: secrets.AUDIT_SELFTEST'            > "${SELF_TEST_DIR}/tree/eof.yml"
  printf 'f: ${{ secrets.AUDIT_SELFTEST }}\n'   > "${SELF_TEST_DIR}/elsewhere/linked.yml"
  ln -s "${SELF_TEST_DIR}/elsewhere" "${SELF_TEST_DIR}/tree/nested/link"
  printf 'n1: ${{ secrets.AUDIT_SELFTEST_SUFFIXED }}\nn2: ${{ secrets.PRE_AUDIT_SELFTEST }}\n' \
    > "${SELF_TEST_DIR}/neg/x.yml"

}

scan_prepare "${SELF_TEST_DIR}/tree"
st_hits=$(ref_grep AUDIT_SELFTEST)
scan_prepare "${SELF_TEST_DIR}/neg"
st_neg=$(ref_grep AUDIT_SELFTEST)
missing=""
for style in upper lower spaced vars eof link; do
  printf '%s' "${st_hits}" | grep -q "${style}" || missing="${missing} ${style}"
done

if [[ -n "${missing}" ]]; then
  err "reference pattern MISSED these styles:${missing}"
  echo "        Gate 1 would report a live reference as clean."
  echo "        grep: $(grep --version 2>&1 | head -1)"
elif [[ -n "${st_neg}" ]]; then
  err "reference pattern matched a known-negative (prefixed/suffixed name)."
else
  SELF_TEST_OK=1
  ok "reference pattern self-test passed (upper, lower, spaced-dot, vars, EOL, symlink)."
fi

GIT_OK=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  GIT_OK=1
  ok "git is usable."
  # Gate 5 uses `git grep`, a DIFFERENT regex engine from Gate 1's `grep`.
  if [[ -z "$(git grep -hoiE '(secrets|vars)[[:space:]]*\.[[:space:]]*(AZ_CLIENT_ID|__NOPE__)' HEAD -- .github/ 2>/dev/null)" ]]; then
    err "git grep failed to match a known-present reference (secrets.AZ_CLIENT_ID)."
    echo "        Gate 5 cannot be trusted; it would report every branch as clean."
    GIT_GREP_OK=0
  else
    ok "git grep self-test passed."
    GIT_GREP_OK=1
  fi
else
  err "git is NOT usable -- branch and PR gates cannot run."
  echo "        $(git --version 2>&1 | head -1)"
  GIT_GREP_OK=0
fi

GH_OK=0
if gh auth status >/dev/null 2>&1 && gh api "repos/${REPO}" -q .full_name >/dev/null 2>&1; then
  GH_OK=1
  ok "gh is authenticated and can reach ${REPO}."
else
  err "gh is unauthenticated or cannot reach ${REPO} -- API gates cannot run."
fi
echo

# --- Gate 1: nothing on this ref may reference a deletion target ------------
echo "--- Gate 1: references on the current working tree ---"
if [[ ${SELF_TEST_OK} -eq 0 ]]; then
  err "SKIPPED -- the reference pattern failed its self-test, so any result"
  echo "        from this gate would be meaningless."
else
  scan_prepare .github/
  if [[ ${#SCAN_UNREADABLE[@]} -gt 0 ]]; then
    err "${#SCAN_UNREADABLE[@]} file(s) under .github/ are unreadable and were NOT scanned:"
    printf '        %s\n' "${SCAN_UNREADABLE[@]}"
    echo "        A reference could be hiding in them. Fix permissions and re-run."
  fi
  if [[ ${#SCAN_FILES[@]} -eq 0 ]]; then
    err "no readable files found under .github/ -- nothing was actually scanned."
  else
    g1=0
    for name in "${ALL[@]}"; do
      hits=$(ref_grep "${name}")
      if [[ -n "${hits}" ]]; then
        fail "${name} is still referenced:"
        echo "${hits}" | indent
        g1=$((g1 + 1))
      fi
    done
    if [[ ${g1} -eq 0 ]]; then
      ok "no deletion target is referenced across ${#SCAN_FILES[@]} scanned file(s)."
    fi
  fi
fi
echo

# --- Gate 2: the checks that make a static grep sound -----------------------
echo "--- Gate 2: static-analysis soundness ---"
# Case- and whitespace-insensitive: GHA expression function names are
# case-insensitive, so toJson(secrets) is as valid as toJSON(secrets).
dynamic=$(grep -RinE 'toJSON[[:space:]]*\([[:space:]]*(secrets|vars)[[:space:]]*\)|(secrets|vars)[[:space:]]*\[' .github/ 2>/dev/null)
drc=$?
if [[ ${drc} -ge 2 ]]; then
  err "dynamic-access scan errored (rc=${drc}); Gate 1 soundness unproven."
elif [[ -n "${dynamic}" ]]; then
  fail "dynamic secret/variable access found -- Gate 1 cannot be trusted:"
  echo "${dynamic}" | indent
else
  ok "no dynamic access (toJSON(secrets), secrets[..], vars[..])."
fi

if [[ -d .github/actions ]]; then
  warn ".github/actions/ now exists; composite actions can consume secrets."
  echo "        Re-verify Gate 1 covers them."
else
  ok "no composite actions; workflows are the only consumer surface."
fi

inherit=$(grep -Rn "secrets:[[:space:]]*inherit" .github/ 2>/dev/null)
if [[ -n "${inherit}" ]]; then
  warn "'secrets: inherit' present (cams-x83dl). Benign for deletion while Gate 1"
  echo "        passes, since callee references are caught there too:"
  echo "${inherit}" | indent
fi
echo

# --- Gate 3: other secret scopes -------------------------------------------
echo "--- Gate 3: other secret scopes ---"
if [[ ${GH_OK} -eq 1 ]]; then
  for scope in dependabot codespaces; do
    if out=$(gh api "repos/${REPO}/${scope}/secrets" -q '.secrets[].name' 2>/dev/null); then
      n=$(printf '%s' "${out}" | grep -c . )
      if [[ "${n}" -eq 0 ]]; then
        ok "${scope} secret scope is empty."
      else
        warn "${scope} scope has ${n} secret(s); confirm no name overlap."
      fi
    else
      err "could not read ${scope} secret scope."
    fi
  done
  echo "  NOTE  org-level secrets are not listable without admin:org. A repo-scope"
  echo "        delete can fall through to an org secret of the same name."
else
  err "skipped -- gh unavailable."
fi
echo

# --- Gate 4: environment-scoped shadows ------------------------------------
echo "--- Gate 4: environment-scoped objects with the same names ---"
if [[ ${GH_OK} -eq 1 ]]; then
  if envs=$(gh api "repos/${REPO}/environments" --paginate -q '.environments[].name' 2>/dev/null); then
    declare -A SHADOW_MAP=()
    declare -A SHADOW_ENVS=()
    shadows=0
    while read -r env; do
      [[ -z "${env}" ]] && continue
      enc=$(urlencode "${env}")
      # gh api prints its JSON error body to STDOUT, so an unchecked capture
      # yields non-empty garbage that silently matches nothing. Check status.
      es=$(gh api "repos/${REPO}/environments/${enc}/secrets" -q '.secrets[].name' 2>/dev/null) \
        || { err "could not read secrets for environment '${env}'."; continue; }
      ev=$(gh api "repos/${REPO}/environments/${enc}/variables" -q '.variables[].name' 2>/dev/null) \
        || { err "could not read variables for environment '${env}'."; continue; }
      env_objs=$(printf '%s\n%s' "${es}" "${ev}")
      for name in "${ALL[@]}"; do
        if printf '%s' "${env_objs}" | grep -qx "${name}"; then
          SHADOW_MAP["${name}"]="${SHADOW_MAP[${name}]:-} ${env}"
          SHADOW_ENVS["${env}"]=1
          shadows=$((shadows + 1))
        fi
      done
    done <<< "${envs}"

    if [[ ${shadows} -eq 0 ]]; then
      ok "no environment-scoped objects share these names."
    else
      # Compare against the environments that shadow ANY target, not all 20+
      # environments in the repo -- otherwise every name looks asymmetric and
      # the genuinely asymmetric one is lost in the noise.
      env_count=${#SHADOW_ENVS[@]}
      for name in "${!SHADOW_MAP[@]}"; do
        present="${SHADOW_MAP[${name}]# }"
        present_count=$(printf '%s' "${present}" | wc -w | tr -d ' ')
        warn "'${name}' also exists at environment scope: ${present}"
        echo "        These are SEPARATE objects. Delete at repo scope only."
        if [[ ${present_count} -lt ${env_count} ]]; then
          echo "        ASYMMETRIC: absent from the other shadowing environment(s), so"
          echo "        repo scope is the ONLY fallback there. Confirm nothing under"
          echo "        those environments reads it before deleting."
        fi
      done
    fi
  else
    err "could not list environments."
  fi
else
  err "skipped -- gh unavailable."
fi
echo

# --- Gate 5: open PRs -------------------------------------------------------
echo "--- Gate 5: open pull requests ---"
pattern=$(printf '%s|' "${ALL[@]}"); pattern="${pattern%|}"
PR_LIMIT=200
if [[ ${GH_OK} -eq 1 && ${GIT_OK} -eq 1 && ${GIT_GREP_OK} -eq 1 ]]; then
  if open_prs=$(gh pr list -R "${REPO}" --state open --limit "${PR_LIMIT}" \
      --json number,headRefName,isCrossRepository \
      -q '.[] | "\(.number) \(.isCrossRepository) \(.headRefName)"' 2>/dev/null); then
    pr_count=$(printf '%s' "${open_prs}" | grep -c . )
    [[ ${pr_count} -ge ${PR_LIMIT} ]] && \
      warn "open PR list hit the --limit of ${PR_LIMIT}; results may be truncated."
    if [[ ${pr_count} -eq 0 ]]; then
      ok "no open pull requests."
    else
      dirty=0
      while read -r num fork branch; do
        [[ -z "${branch}" ]] && continue
        if [[ "${fork}" == "true" ]]; then
          # Fork PRs never receive repository secrets, so they cannot break.
          # Skipped deliberately, and said out loud rather than passed silently.
          echo "  NOTE  PR #${num} is from a fork; forks receive no secrets. Skipped."
          continue
        fi
        if ! git rev-parse --verify --quiet "origin/${branch}^{commit}" >/dev/null; then
          err "PR #${num} (${branch}): ref origin/${branch} is not fetched locally."
          echo "        Cannot check it. Run 'git fetch origin --prune' and re-run."
          continue
        fi
        h=$(git grep -hoiE "(secrets|vars)[[:space:]]*\.[[:space:]]*(${pattern})([^A-Za-z0-9_]|$)" \
          "origin/${branch}" -- .github/ 2>/dev/null | sort -u | tr '\n' ' ')
        if [[ -n "${h}" ]]; then
          warn "PR #${num} (${branch}) still references: ${h}"
          dirty=$((dirty + 1))
        fi
      done <<< "${open_prs}"
      [[ ${dirty} -eq 0 ]] && ok "every non-fork open PR is clean."
    fi
  else
    err "could not list open pull requests."
  fi
else
  err "skipped -- needs git, gh, and a working git grep."
fi
echo

# --- Optional: every remote branch -----------------------------------------
if [[ ${SCAN_ALL_BRANCHES} -eq 1 ]]; then
  echo "--- Optional: all remote branches ---"
  if [[ ${GIT_OK} -eq 1 && ${GIT_GREP_OK} -eq 1 ]]; then
    count=0
    while read -r ref; do
      h=$(git grep -hoiE "(secrets|vars)[[:space:]]*\.[[:space:]]*(${pattern})([^A-Za-z0-9_]|$)" \
        "${ref}" -- .github/ 2>/dev/null | sort -u | tr '\n' ' ')
      if [[ -n "${h}" ]]; then
        d=$(git log -1 --format=%cs "${ref}" 2>/dev/null)
        behind=$(git rev-list --count "${ref}..origin/main" 2>/dev/null)
        printf '  %-48s last=%s behind=%s\n' "${ref#origin/}" "${d}" "${behind}"
        count=$((count + 1))
      fi
    done < <(git branch -r --format='%(refname:short)' | grep -v HEAD)
    echo "  ${count} branch(es) still reference a deletion target."
    echo "  Informational only -- see the runbook for why this does not gate deletion."
  else
    err "skipped -- needs git and a working git grep."
  fi
  echo
fi

# --- Summary ----------------------------------------------------------------
echo "=============================================================="
if [[ ${failures} -gt 0 ]]; then
  echo " RESULT: ${failures} FAILURE(S), ${errors} error(s), ${warnings} warning(s)"
  echo " Do NOT delete. Resolve the failures above first."
  echo "=============================================================="
  exit 1
fi
if [[ ${errors} -gt 0 ]]; then
  echo " RESULT: INCONCLUSIVE -- ${errors} gate(s) could not run, ${warnings} warning(s)"
  echo " The gates that did run found nothing, but the skipped ones are part of"
  echo " the safety case. Fix the tooling above and re-run before deleting."
  echo "=============================================================="
  exit 3
fi
if [[ ${warnings} -gt 0 ]]; then
  # Warnings are not automatically safe. Gate 4 and Gate 5 findings -- an
  # environment-scope shadow, an open PR still referencing a target -- are
  # part of the safety case and need a human to read them, not a green light.
  echo " RESULT: PASS WITH ${warnings} WARNING(S) -- read them before deleting."
  echo " No deletion target is referenced on this ref, but the warnings above"
  echo " are load-bearing. STRICT=true makes them exit non-zero."
  echo "=============================================================="
  [[ "${STRICT:-false}" == "true" ]] && exit 4
  exit 0
fi
echo " RESULT: PASS (no findings)"
echo " Safe to proceed with the runbook's deletion steps."
echo "=============================================================="
exit 0
