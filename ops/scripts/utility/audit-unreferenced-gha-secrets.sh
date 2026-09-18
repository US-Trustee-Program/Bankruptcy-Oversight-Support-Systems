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
# SCOPE: the name list below is FROZEN to CAMS-760. It is the output of one
# audit of one commit, not a live inventory, and this script is a gate for that
# specific cleanup rather than a general "find unused secrets" tool.
#
# SHELF LIFE: this script is scaffolding. The runbook
# (docs/operations/gha-secret-deletion.md) is the durable artifact. Once
# cams-9n4tg is verified complete, DELETE this script rather than leaving a
# general-purpose-looking utility that structurally cannot do a general-purpose
# job. Gate 7 reports how far the list has drifted from live scope in the
# meantime; it does not repair it. Tracked as cams-xug4r.
#
# Do NOT regenerate the list by diffing the live secret inventory against
# references on `main` alone. A secret added by an in-flight branch is absent
# from `main` by definition, so that method reports a colleague's new secret as
# unused and deletes their work. Gate 6 exists to catch exactly that mistake:
# any branch with commits in the last ACTIVE_DAYS that references a listed name
# is a hard failure. Anyone extending this list must clear Gate 6 first.
#
# KNOWN LIMIT: Gates 5 and 6 read other refs with `git grep`, which treats a
# symlinked directory as a blob and does not descend it. Gate 1's `find -L` walk
# has no such blind spot, so a reference hidden behind a symlinked directory is
# caught on the current ref but not on another branch. Fixing it would mean
# checking every branch out, which is not worth the cost here -- but do not
# assume branch coverage is identical to Gate 1's.
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

# Gate 4 uses associative arrays (bash 4+). Stock macOS ships bash 3.2, where
# `declare -A` fails and the subsequent assignment is parsed arithmetically,
# aborting mid-run under `set -u` with no summary line and an undocumented 127.
if [[ "${BASH_VERSINFO[0]:-0}" -lt 4 ]]; then
  echo "ERROR: bash 4+ required (found ${BASH_VERSION:-unknown})." >&2
  echo "       On macOS: brew install bash, or run with a bash 4+ interpreter." >&2
  exit 2
fi

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
  echo "GH_REPO       owner/repo to audit. Defaults to the US-Trustee-Program repo."
  echo "              Set this when 'git' cannot resolve the remote."
  echo "STRICT        'true' makes any warning exit 4 instead of 0."
  echo "ACTIVE_DAYS   branch recency window; a reference from a branch newer than"
  echo "              this is a hard failure in Gates 5 and 6 (default 90)."
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

# Gates 5 and 6 read LOCAL remote-tracking refs. A branch this clone has never
# fetched simply does not exist to them, so the gate that exists to catch "an
# active branch still references this" is blind to exactly the branch most
# likely to be new. Checked once, used by both.
CLONE_CURRENT=-1   # -1 unknown, 0 stale/unverifiable, 1 current
CLONE_STALE_MSG=""
clone_is_current() {
  [[ ${CLONE_CURRENT} -ne -1 ]] && return ${CLONE_CURRENT}
  local heads n missing=0 sha ref local_sha
  if ! heads=$(git ls-remote --heads origin 2>/dev/null); then
    CLONE_CURRENT=0; CLONE_STALE_MSG="could not reach the remote to verify freshness"
    return 1
  fi
  n=$(printf '%s' "${heads}" | grep -c . )
  if [[ "${n}" -eq 0 ]]; then
    CLONE_CURRENT=0; CLONE_STALE_MSG="git ls-remote returned no branches"
    return 1
  fi
  while read -r sha ref; do
    [[ -z "${ref}" ]] && continue
    local_sha=$(git rev-parse --verify --quiet "refs/remotes/origin/${ref#refs/heads/}" 2>/dev/null)
    [[ "${local_sha}" == "${sha}" ]] || missing=$((missing + 1))
  done <<< "${heads}"
  if [[ ${missing} -gt 0 ]]; then
    CLONE_CURRENT=0
    CLONE_STALE_MSG="${missing} remote branch(es) missing locally or out of date"
    return 1
  fi
  CLONE_CURRENT=1
  return 0
}

# git grep exits 1 both for "no match" and for "could not read that object", so
# a captured-and-empty result is ambiguous. Route stderr to REF_ERR_FILE so the
# caller can tell the two apart.
branch_grep() {  # branch_grep <ref> <alternation>
  : > "${REF_ERR_FILE}"
  git grep -hoiE "(secrets|vars)[[:space:]]*\.[[:space:]]*($2)([^A-Za-z0-9_]|$)" \
    "$1" -- .github/ 2>"${REF_ERR_FILE}" | sort -u | tr '\n' ' '
}

# A branch with recent commits is someone's work in progress; a branch untouched
# for months is residue. The distinction decides whether a reference is a hard
# failure or a note, so it is configurable rather than buried.
ACTIVE_DAYS="${ACTIVE_DAYS:-90}"

# Validated before any arithmetic uses it. Under `set -u` a non-numeric value
# makes $(( ... )) fatal mid-run, and the script exits 1 -- which this contract
# defines as "a deletion target is still referenced", sending the operator to
# hunt a reference that does not exist.
if ! [[ "${ACTIVE_DAYS}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: ACTIVE_DAYS must be a non-negative integer (got: '${ACTIVE_DAYS}')." >&2
  exit 2
fi

branch_age_days() {  # branch_age_days <ref>
  local ts
  ts=$(git log -1 --format=%ct "$1" 2>/dev/null) || { echo "unknown"; return; }
  echo $(( ( $(date +%s) - ts ) / 86400 ))
}

branch_is_active() {  # branch_is_active <ref>
  local ts
  ts=$(git log -1 --format=%ct "$1" 2>/dev/null) || return 1
  [[ ${ts} -ge $(( $(date +%s) - ACTIVE_DAYS * 86400 )) ]]
}

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
SCAN_TRAVERSAL_ERR=""
scan_prepare() {  # scan_prepare <path>
  local path="$1" f errfile
  SCAN_FILES=()
  SCAN_UNREADABLE=()
  SCAN_TRAVERSAL_ERR=""
  errfile=$(mktemp) || { SCAN_TRAVERSAL_ERR="mktemp failed"; return 1; }
  # find's own status is lost inside a process substitution, so its stderr is
  # captured instead: an unreadable directory or a symlink loop would otherwise
  # shrink SCAN_FILES silently and Gate 1 would scan an incomplete set cleanly.
  while IFS= read -r f; do
    [[ -z "${f}" ]] && continue
    if [[ -r "${f}" ]]; then SCAN_FILES+=("${f}"); else SCAN_UNREADABLE+=("${f}"); fi
  done < <(find -L "${path}" -type f 2>"${errfile}")
  [[ -s "${errfile}" ]] && SCAN_TRAVERSAL_ERR=$(head -3 "${errfile}")
  rm -f "${errfile}"
  [[ -z "${SCAN_TRAVERSAL_ERR}" ]]
}

# ref_grep is called inside a command substitution, so it cannot report an error
# back through a variable. It writes grep's stderr to REF_ERR_FILE, which the
# caller checks -- a file survives the subshell where an assignment would not.
# Without this, a file that becomes unreadable between scan_prepare and grep
# (grep exits 2) is indistinguishable from a file with no reference.
REF_ERR_FILE=$(mktemp) || { echo "ERROR: mktemp failed." >&2; exit 3; }
ref_grep() {  # ref_grep <NAME>
  : > "${REF_ERR_FILE}"
  [[ ${#SCAN_FILES[@]} -eq 0 ]] && return 1
  grep -HinE "(secrets|vars)[[:space:]]*\.[[:space:]]*${1}([^A-Za-z0-9_]|\$)" \
    "${SCAN_FILES[@]}" 2>"${REF_ERR_FILE}"
}

# Same file set as Gate 1, so Gate 2 cannot certify soundness over a narrower
# view than the gate it exists to certify.
set_grep() {  # set_grep <ERE>
  : > "${REF_ERR_FILE}"
  [[ ${#SCAN_FILES[@]} -eq 0 ]] && return 1
  grep -HinE "$1" "${SCAN_FILES[@]}" 2>"${REF_ERR_FILE}"
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
trap '[[ -n "${SELF_TEST_DIR:-}" ]] && rm -rf "${SELF_TEST_DIR}"; [[ -n "${REF_ERR_FILE:-}" ]] && rm -f "${REF_ERR_FILE}"' EXIT

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
  # Probe name derived from the tree rather than hardcoded: pinning it to a
  # specific secret means renaming that secret silently disables Gates 5 and 6.
  probe_name=$(grep -rhoiE '(secrets|vars)[[:space:]]*\.[[:space:]]*[A-Za-z0-9_]+' .github/ 2>/dev/null \
    | sed -E 's/.*[.][[:space:]]*//' | sort -u | head -1)
  if [[ -z "${probe_name}" ]]; then
    err "no secret/variable reference found in .github/ to probe git grep with."
    GIT_GREP_OK=0
  elif [[ -z "$(branch_grep HEAD "${probe_name}")" ]]; then
    err "git grep failed to match a known-present reference (${probe_name})."
    echo "        Gates 5 and 6 cannot be trusted; they would report every branch clean."
    GIT_GREP_OK=0
  else
    ok "git grep self-test passed (probe: ${probe_name})."
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
  if [[ -n "${SCAN_TRAVERSAL_ERR}" ]]; then
    err "traversing .github/ produced errors; the file set may be incomplete:"
    echo "${SCAN_TRAVERSAL_ERR}" | indent
  fi
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
      if [[ -s "${REF_ERR_FILE}" ]]; then
        err "${name}: grep errored; cannot conclude this name is unused:"
        head -3 "${REF_ERR_FILE}" | indent
        g1=$((g1 + 1))
      elif [[ -n "${hits}" ]]; then
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
# set_grep reads SCAN_FILES. If Gate 1 was skipped or found nothing, that array
# still holds the preflight's self-test fixture, and Gate 2 would certify
# soundness over a temp file while silently dropping real findings.
GATE2_OK=1
if ! scan_prepare .github/ || [[ ${#SCAN_FILES[@]} -eq 0 ]]; then
  err "cannot rebuild the .github/ file set; Gate 2 cannot certify anything."
  GATE2_OK=0
fi
# Case- and whitespace-insensitive: GHA expression function names are
# case-insensitive, so toJson(secrets) is as valid as toJSON(secrets).
dynamic=$(set_grep 'toJSON[[:space:]]*\([[:space:]]*(secrets|vars)[[:space:]]*\)|(secrets|vars)[[:space:]]*\[')
if [[ -s "${REF_ERR_FILE}" ]]; then
  err "dynamic-access scan errored; Gate 1 soundness unproven:"
  head -3 "${REF_ERR_FILE}" | indent
elif [[ -n "${dynamic}" ]]; then
  fail "dynamic secret/variable access found -- Gate 1 cannot be trusted:"
  echo "${dynamic}" | indent
elif [[ ${GATE2_OK} -eq 1 ]]; then
  ok "no dynamic access (toJSON(secrets), secrets[..], vars[..])."
fi

if [[ -d .github/actions ]]; then
  warn ".github/actions/ now exists; composite actions can consume secrets."
  echo "        Re-verify Gate 1 covers them."
else
  ok "no composite actions; workflows are the only consumer surface."
fi

inherit=$(set_grep "secrets:[[:space:]]*inherit")
if [[ -s "${REF_ERR_FILE}" ]]; then
  err "'secrets: inherit' scan errored:"
  head -2 "${REF_ERR_FILE}" | indent
elif [[ -n "${inherit}" ]]; then
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
    declare -A SHADOW_COUNT=()
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
          SHADOW_COUNT["${name}"]=$(( ${SHADOW_COUNT[${name}]:-0} + 1 ))
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
        present_count=${SHADOW_COUNT[${name}]:-0}
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
        h=$(branch_grep "origin/${branch}" "${pattern}")
        if [[ -s "${REF_ERR_FILE}" ]]; then
          err "PR #${num} (${branch}): git grep errored; cannot conclude it is clean."
          head -2 "${REF_ERR_FILE}" | indent
          continue
        fi
        if [[ -n "${h}" ]]; then
          if branch_is_active "origin/${branch}"; then
            fail "PR #${num} (${branch}) is ACTIVE and still references: ${h}"
            echo "        Last commit $(branch_age_days "origin/${branch}") day(s) ago."
            echo "        Deleting these would break work in progress. Stop."
          else
            warn "PR #${num} (${branch}) references: ${h}"
            echo "        Dormant ($(branch_age_days "origin/${branch}") day(s) old); informational."
          fi
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

# --- Gate 6: ACTIVE branches, with or without a pull request ----------------
# Gate 5 only sees branches that already have an open PR. Someone actively
# working on a branch that ADDS a secret has no PR yet, so a main-only view
# reports that secret as unused and the operator deletes a colleague's work.
# This gate is the answer to that: any branch with recent commits that
# references a deletion target is a hard failure, PR or no PR.
echo "--- Gate 6: active branches (last ${ACTIVE_DAYS} days) ---"
if [[ ${GIT_OK} -eq 1 && ${GIT_GREP_OK} -eq 1 ]]; then
  # Without this, an unfetched branch is invisible and the gate prints OK --
  # defeating the one scenario it exists for.
  if ! clone_is_current; then
    err "cannot verify this clone is current: ${CLONE_STALE_MSG}."
    echo "        An unfetched branch is invisible to this gate, which is exactly" >&2
    echo "        the branch most likely to be new. Run: git fetch origin --prune" >&2
  fi
  now=$(date +%s)
  cutoff=$((now - ACTIVE_DAYS * 86400))
  active_total=0
  active_dirty=0
  while read -r ref ts; do
    # refname:short renders refs/remotes/origin/HEAD as bare "origin", not
    # "origin/HEAD", so a */HEAD test never fires and origin/HEAD re-scans main
    # under an alias -- defeating the origin/main exclusion below.
    [[ -z "${ref}" || "${ref}" == "origin" ]] && continue
    [[ "${ts}" -lt ${cutoff} ]] && continue
    # origin/main is deliberately NOT excluded. Gate 1 scans the working tree,
    # which is main only if the operator happens to be on it; on any feature
    # branch main would otherwise go unscanned entirely.
    active_total=$((active_total + 1))
    h=$(branch_grep "${ref}" "${pattern}")
    if [[ -s "${REF_ERR_FILE}" ]]; then
      err "${ref#origin/}: git grep errored; cannot conclude it is clean."
      head -2 "${REF_ERR_FILE}" | indent
      continue
    fi
    if [[ -n "${h}" ]]; then
      fail "ACTIVE branch ${ref#origin/} references: ${h}"
      echo "        Last commit $(branch_age_days "${ref}") day(s) ago."
      echo "        Deleting these would break work in progress. Stop."
      active_dirty=$((active_dirty + 1))
    fi
  done < <(git for-each-ref --format='%(refname:short) %(committerdate:unix)' refs/remotes/origin)
  if [[ ${active_total} -eq 0 ]]; then
    err "no active branches to scan; this gate verified nothing."
  elif [[ ${active_dirty} -eq 0 ]]; then
    ok "none of the ${active_total} active branch(es) reference a deletion target."
  fi
else
  err "skipped -- needs git and a working git grep."
fi
echo

# --- Gate 7: drift between the frozen list and live repository scope --------
# Every other gate checks references to a fixed list and never asks GitHub what
# actually exists, which means the list silently rots: run this a year from now
# and it audits names that were deleted months ago while being structurally
# blind to anything added since.
#
# This gate enumerates live repository scope purely to REPORT that drift.
#
# Enumeration deliberately does NOT feed the deletion list. "Unreferenced on the
# current ref" is exactly the test that misidentifies a secret added by an
# in-flight branch (see Gate 6), so an orphan found here is a prompt for a human
# to investigate -- never something to delete on this script's say-so.
echo "--- Gate 7: frozen-list drift vs live repository scope ---"
if [[ ${GH_OK} -eq 1 && ${SELF_TEST_OK} -eq 1 && ${#SCAN_FILES[@]} -gt 0 \
      && -z "${SCAN_TRAVERSAL_ERR}" && ${#SCAN_UNREADABLE[@]} -eq 0 ]]; then
  live_secrets=$(gh api "repos/${REPO}/actions/secrets" --paginate -q '.secrets[].name' 2>/dev/null)
  ls_rc=$?
  live_vars=$(gh api "repos/${REPO}/actions/variables" --paginate -q '.variables[].name' 2>/dev/null)
  lv_rc=$?
  if [[ ${ls_rc} -ne 0 || ${lv_rc} -ne 0 ]]; then
    err "could not enumerate repository-scope secrets/variables."
  else
    live_all=$(printf '%s\n%s' "${live_secrets}" "${live_vars}")

    # If NOTHING in live scope is referenced anywhere, the scan is broken --
    # reporting all of repository scope as drift would be the same 100%-false
    # result the orphan auditor guards against.
    any_referenced=0
    while read -r _n; do
      [[ -z "${_n}" ]] && continue
      if [[ -n "$(ref_grep "${_n}")" ]]; then any_referenced=1; break; fi
    done <<< "${live_all}"
    if [[ ${any_referenced} -eq 0 ]]; then
      err "no live secret or variable is referenced anywhere -- the scan is"
      echo "        broken, not the repository. Not reporting drift." | indent
      live_all=""
    fi

    gone=0
    for name in "${ALL[@]}"; do
      printf '%s' "${live_all}" | grep -qx "${name}" || gone=$((gone + 1))
    done
    if [[ ${gone} -gt 0 ]]; then
      echo "  NOTE  ${gone} of ${#ALL[@]} targets no longer exist -- the runbook has"
      echo "        been partially executed, or the list has aged."
    fi

    orphans=0
    while read -r name; do
      [[ -z "${name}" ]] && continue
      printf '%s\n' "${ALL[@]}" | grep -qx "${name}" && continue
      if [[ -z "$(ref_grep "${name}")" ]] && [[ ! -s "${REF_ERR_FILE}" ]]; then
        if [[ ${orphans} -eq 0 ]]; then
          warn "live objects are unreferenced but NOT in the frozen list:"
        fi
        echo "        ${name}"
        orphans=$((orphans + 1))
      fi
    done <<< "${live_all}"

    if [[ ${orphans} -gt 0 ]]; then
      echo "        Either this list is stale, or someone added a secret that is not"
      echo "        yet referenced on this ref. DO NOT delete these on this script's"
      echo "        say-so -- an in-flight branch looks identical from here."
    elif [[ ${gone} -eq 0 ]]; then
      ok "frozen list exactly matches live unreferenced repository scope."
    fi
  fi
else
  err "skipped -- needs gh, a passing self-test, and a populated file set."
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
    done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin \
      | while IFS= read -r r; do [[ "${r}" == "origin" ]] || echo "${r}"; done)
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
