#!/usr/bin/env bash

# Reports GitHub Actions secrets and variables at REPOSITORY scope that nothing
# references. Read-only, and permanently so.
#
# This is the durable counterpart to the one-time CAMS-760 cleanup gate
# (audit-unreferenced-gha-secrets.sh, deleted once that cleanup completes). That
# script checks references against a frozen list of 31 names; this one enumerates
# live scope and asks what has gone stale since. Orphans accumulate silently --
# 31 of them built up here over years precisely because nothing was watching.
#
# THREE RULES, in order of how badly breaking them hurts:
#
# 1. SILENT BY DEFAULT. A report that lists the same standing orphans every run
#    gets muted, and a muted check is worse than no check because it reads as
#    coverage. Known-and-accepted orphans live in the baseline file; this script
#    speaks only when the set CHANGES.
#
# 2. REFERENCES ARE CHECKED ACROSS ACTIVE BRANCHES, NOT JUST THE CURRENT REF.
#    A secret added by an in-flight branch is absent from main by definition. A
#    main-only check would report a colleague's new secret as an orphan, and
#    acting on that deletes their work.
#
# 3. REPORT-ONLY, PERMANENTLY. This never deletes anything and never emits a
#    deletion command. "Unreferenced" is evidence for a human, not an
#    instruction. Deletion happens through a runbook that a person reads.
#
# THE DANGEROUS DIRECTION IS A FALSE ORPHAN. Reporting a secret that IS
# referenced sends a human to delete something live, irreversibly. Missing a
# genuinely unused secret just leaves clutter. So every failure path must refuse
# to report rather than report an empty reference set: an empty set and "nothing
# is referenced" are arithmetically identical and catastrophically different in
# meaning.
#
# Usage
#   From the root directory:
#     ./ops/scripts/utility/audit-orphaned-gha-secrets.sh [-u|-a|-h]
#
# Exit codes
#   0  no new orphans (silent success), or -a / -h
#   1  new orphans found, not present in the baseline. Never returned by -a,
#      which lists baselined entries by design and so cannot mean "new".
#   2  usage error / not run from the repository root
#   3  inconclusive -- a check could not run (never reported as success)

set -uo pipefail

BASELINE="ops/scripts/utility/gha-orphan-secrets.baseline"
REPO="${GH_REPO:-US-Trustee-Program/Bankruptcy-Oversight-Support-Systems}"
ACTIVE_DAYS="${ACTIVE_DAYS:-90}"

Help() {
  echo "Reports repository-scope GitHub Actions secrets/variables that nothing references."
  echo "Read-only: this script never deletes anything."
  echo
  echo "Syntax: ./ops/scripts/utility/audit-orphaned-gha-secrets.sh [-u|-a|-h]"
  echo "options:"
  echo "u     Update the baseline to the current orphan set, then exit."
  echo "a     Report ALL orphans, including baselined ones. Always exits 0."
  echo "h     Print this Help and exit."
  echo
  echo "environment:"
  echo "GH_REPO       owner/repo to audit. Defaults to the US-Trustee-Program repo."
  echo "ACTIVE_DAYS   branch recency window for reference checking (default 90)."
  echo "              Must be a non-negative integer."
  echo
  echo "Requires a token with repository admin -- listing secrets needs it, and"
  echo "GITHUB_TOKEN in Actions does not have it. Names only; values are never read."
  echo
}

UPDATE_BASELINE=0
SHOW_ALL=0
while getopts ":uah" opt; do
  case "${opt}" in
    u) UPDATE_BASELINE=1 ;;
    a) SHOW_ALL=1 ;;
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

# Validated before use: under `set -u` a non-numeric value makes the arithmetic
# below fatal, and because reference collection runs inside a command
# substitution the subshell would die BEFORE any grep ran -- yielding an empty
# reference set and a confident report that every live secret is an orphan.
if ! [[ "${ACTIVE_DAYS}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: ACTIVE_DAYS must be a non-negative integer (got: '${ACTIVE_DAYS}')." >&2
  exit 2
fi

if [[ ! -d .github ]]; then
  echo "ERROR: run this from the repository root (no .github directory here)." >&2
  exit 2
fi

errors=0
err() { echo "  ERROR $*" >&2; errors=$((errors + 1)); }

# Deliberately self-contained rather than sharing helpers with the CAMS-760
# gate: that script is scheduled for deletion, so a shared library would break
# when it goes. The duplication resolves itself.
#
# GitHub expression property access is case-insensitive, so `secrets.azure_rg`
# references AZURE_RG; whitespace is permitted around the dot. find -L is used
# because BSD grep -R does not follow symlinked subdirectories and would report
# "no match" having searched nothing.
SCAN_FILES=()
SCAN_UNREADABLE=0
scan_prepare() {
  local f errfile out
  SCAN_FILES=()
  SCAN_UNREADABLE=0
  errfile=$(mktemp) || return 1
  while IFS= read -r f; do
    [[ -z "${f}" ]] && continue
    if [[ -r "${f}" ]]; then
      SCAN_FILES+=("${f}")
    else
      SCAN_UNREADABLE=$((SCAN_UNREADABLE + 1))
    fi
  done < <(find -L .github -type f 2>"${errfile}")
  out=$(head -3 "${errfile}"); rm -f "${errfile}"
  [[ -z "${out}" ]] || { err "traversing .github/ failed: ${out}"; return 1; }
  [[ ${#SCAN_FILES[@]} -gt 0 ]]
}

# Branch partitioning happens in the PARENT shell so the counts survive; doing
# it inside the collection subshell would discard them.
ACTIVE_REFS=()
STALE_REFS=()
partition_branches() {
  local ref ts cutoff
  cutoff=$(( $(date +%s) - ACTIVE_DAYS * 86400 ))
  while read -r ref ts; do
    # refname:short renders refs/remotes/origin/HEAD as bare "origin", so a
    # */HEAD test never fires and origin/HEAD would re-scan the default branch
    # under an alias.
    [[ -z "${ref}" || "${ref}" == "origin" ]] && continue
    if [[ "${ts}" -ge ${cutoff} ]]; then
      ACTIVE_REFS+=("${ref}")
    else
      STALE_REFS+=("${ref}")
    fi
  done < <(git for-each-ref --format='%(refname:short) %(committerdate:unix)' refs/remotes/origin)
}

# Collects every reference in ONE pass per ref using a single alternation,
# rather than one git grep per name per branch (~n_names x n_branches
# invocations -- around a thousand here, far too slow for repeated use).
#
# Writes matches to stdout; any error goes to COLLECT_ERR_FILE for the caller to
# check, because this runs in a command substitution where a variable would not
# survive. grep exiting 1 ("no match") is legitimate and leaves the file empty.
COLLECT_ERR_FILE=""
collect_references() {  # collect_references <NAME1|NAME2|...>
  local alt="$1" ref
  grep -hoiE "(secrets|vars)[[:space:]]*\.[[:space:]]*(${alt})([^A-Za-z0-9_]|$)" \
    "${SCAN_FILES[@]}" 2>>"${COLLECT_ERR_FILE}"
  for ref in ${ACTIVE_REFS[@]+"${ACTIVE_REFS[@]}"}; do
    git grep -hoiE "(secrets|vars)[[:space:]]*\.[[:space:]]*(${alt})([^A-Za-z0-9_]|$)" \
      "${ref}" -- .github/ 2>>"${COLLECT_ERR_FILE}"
  done
}

# --- Preconditions ----------------------------------------------------------
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  err "git is unusable; cannot check references on active branches."
fi
if ! gh auth status >/dev/null 2>&1; then
  err "gh is not authenticated."
fi
if ! scan_prepare; then
  err "could not build the file set to scan."
fi
if [[ ${SCAN_UNREADABLE} -gt 0 ]]; then
  err "${SCAN_UNREADABLE} file(s) under .github/ are unreadable and were not scanned."
  echo "        A reference could be hiding in them, which would make a live" >&2
  echo "        secret look orphaned. Fix permissions and re-run." >&2
fi

# The active-branch check reads LOCAL refs/remotes/origin, so a clone that has
# not fetched recently cannot see recent branches -- and a secret in use on a
# branch this clone has never seen would be reported as an orphan.
if git rev-parse --git-dir >/dev/null 2>&1; then
  if remote_heads=$(git ls-remote --heads origin 2>/dev/null); then
    head_count=$(printf '%s' "${remote_heads}" | grep -c . )
    if [[ "${head_count}" -eq 0 ]]; then
      # Exiting 0 with no heads would otherwise pass this guard vacuously,
      # having verified nothing at all.
      err "git ls-remote returned no branches; cannot confirm this clone is current."
    else
      missing=0
      while read -r sha ref; do
        [[ -z "${ref}" ]] && continue
        local_sha=$(git rev-parse --verify --quiet "refs/remotes/origin/${ref#refs/heads/}" 2>/dev/null)
        [[ "${local_sha}" == "${sha}" ]] || missing=$((missing + 1))
      done <<< "${remote_heads}"
      if [[ ${missing} -gt 0 ]]; then
        err "${missing} remote branch(es) are missing locally or out of date."
        echo "        This clone cannot see them, so a secret referenced only on one" >&2
        echo "        would be reported as an orphan. Run: git fetch origin --prune" >&2
      fi
    fi
  else
    err "could not reach the remote to confirm this clone is current."
  fi
fi

partition_branches
if [[ ${#ACTIVE_REFS[@]} -eq 0 ]]; then
  err "no active branches found; the branch half of the check would scan nothing."
fi

if [[ ${errors} -gt 0 ]]; then
  echo "INCONCLUSIVE -- preconditions failed; not reporting a clean result." >&2
  exit 3
fi

COLLECT_ERR_FILE=$(mktemp) || exit 3
st_dir=$(mktemp -d) || exit 3
trap 'rm -f "${COLLECT_ERR_FILE}"; rm -rf "${st_dir}"' EXIT

# --- Self-test: exercise the REAL collection path ---------------------------
# A self-test that only checks the regex shape proves nothing about the code
# that actually produces the reference set -- it passes cleanly through a
# subshell that died before grepping. So this drives collect_references itself,
# over a real file set, and requires every legal reference form to come back.
# shellcheck disable=SC2016  # ${{ }} are GitHub Actions literals, not shell expansions
{
  printf 'a: ${{ secrets.SELFTEST_ALPHA }}\n'   > "${st_dir}/upper.yml"
  printf 'b: ${{ secrets.selftest_alpha }}\n'   > "${st_dir}/lower.yml"
  printf 'c: ${{ secrets . SELFTEST_ALPHA }}\n' > "${st_dir}/spaced.yml"
  printf 'd: ${{ vars.SELFTEST_BETA }}\n'       > "${st_dir}/vars.yml"
  printf 'e: secrets.SELFTEST_BETA'             > "${st_dir}/eof.yml"
}
SAVED_FILES=("${SCAN_FILES[@]}")
SAVED_ACTIVE=("${ACTIVE_REFS[@]}")
SCAN_FILES=("${st_dir}"/*.yml)
ACTIVE_REFS=()
st_out=$(collect_references "SELFTEST_ALPHA|SELFTEST_BETA")
SCAN_FILES=("${SAVED_FILES[@]}")
ACTIVE_REFS=("${SAVED_ACTIVE[@]}")

st_missing=""
grep -qi 'secrets[[:space:]]*\.[[:space:]]*SELFTEST_ALPHA' <<< "${st_out}" || st_missing+=" upper/lower"
grep -q  'secrets\.selftest_alpha'                         <<< "${st_out}" || st_missing+=" lower"
grep -qi 'secrets[[:space:]]\+\.[[:space:]]\+SELFTEST_ALPHA' <<< "${st_out}" || st_missing+=" spaced"
grep -qi 'vars[[:space:]]*\.[[:space:]]*SELFTEST_BETA'     <<< "${st_out}" || st_missing+=" vars"
grep -qi 'secrets[[:space:]]*\.[[:space:]]*SELFTEST_BETA'  <<< "${st_out}" || st_missing+=" eof"
if [[ -n "${st_missing}" ]]; then
  echo "INCONCLUSIVE -- reference collection failed its self-test:${st_missing}" >&2
  exit 3
fi
if [[ -z "$(git grep -hoiE '(secrets|vars)[[:space:]]*\.[[:space:]]*(AZ_CLIENT_ID)([^A-Za-z0-9_]|$)' HEAD -- .github/ 2>/dev/null)" ]]; then
  echo "INCONCLUSIVE -- git grep did not match a known-present reference." >&2
  exit 3
fi

# --- Enumerate live repository scope ----------------------------------------
live_secrets=$(gh api "repos/${REPO}/actions/secrets" --paginate -q '.secrets[].name' 2>/dev/null) || {
  echo "INCONCLUSIVE -- could not list repository secrets." >&2
  echo "Listing secrets requires repository admin; GITHUB_TOKEN does not have it." >&2
  exit 3
}
live_vars=$(gh api "repos/${REPO}/actions/variables" --paginate -q '.variables[].name' 2>/dev/null) || {
  echo "INCONCLUSIVE -- could not list repository variables." >&2
  exit 3
}

live_all=$(printf '%s\n%s' "${live_secrets}" "${live_vars}" | grep -v '^$' | sort -u)
live_arr=()
while IFS= read -r n; do [[ -n "${n}" ]] && live_arr+=("${n}"); done <<< "${live_all}"
if [[ ${#live_arr[@]} -eq 0 ]]; then
  echo "INCONCLUSIVE -- repository scope returned no secrets or variables." >&2
  exit 3
fi
alt=$(printf '%s|' "${live_arr[@]}"); alt="${alt%|}"

: > "${COLLECT_ERR_FILE}"
seen=$(collect_references "${alt}")

if [[ -s "${COLLECT_ERR_FILE}" ]]; then
  echo "INCONCLUSIVE -- reference collection reported errors:" >&2
  head -3 "${COLLECT_ERR_FILE}" >&2
  exit 3
fi
# An empty reference set across an entire repository means the scan did not
# really run. Treating it as "nothing is referenced" is exactly the 100%-false
# report this script must never produce.
if [[ -z "${seen}" ]]; then
  echo "INCONCLUSIVE -- no references found anywhere, which indicates a broken" >&2
  echo "scan rather than a repository where nothing is referenced." >&2
  exit 3
fi

# --- Classify ---------------------------------------------------------------
orphans=()
for name in "${live_arr[@]}"; do
  grep -qiE "\.[[:space:]]*${name}([^A-Za-z0-9_]|$)" <<< "${seen}" && continue
  orphans+=("${name}")
done

# Which orphans are referenced on a branch that fell outside the window? This is
# disclosure, not suppression: those branches are real and someone may rebase
# one, so the operator needs to know the report is window-scoped.
stale_hits=()
if [[ ${#orphans[@]} -gt 0 && ${#STALE_REFS[@]} -gt 0 ]]; then
  orph_alt=$(printf '%s|' "${orphans[@]}"); orph_alt="${orph_alt%|}"
  stale_seen=""
  for ref in "${STALE_REFS[@]}"; do
    stale_seen+=$(git grep -hoiE "(secrets|vars)[[:space:]]*\.[[:space:]]*(${orph_alt})([^A-Za-z0-9_]|$)" \
      "${ref}" -- .github/ 2>/dev/null)$'\n'
  done
  for name in "${orphans[@]}"; do
    grep -qiE "\.[[:space:]]*${name}([^A-Za-z0-9_]|$)" <<< "${stale_seen}" && stale_hits+=("${name}")
  done
fi

if [[ ${UPDATE_BASELINE} -eq 1 ]]; then
  # Only reachable on a healthy run: every failure path above exits before here.
  # Baking a degraded run into the baseline would silence the check permanently
  # and be indistinguishable from a good baseline in review.
  if ! {
    echo "# Known-accepted orphaned GitHub Actions secrets and variables."
    echo "# Regenerate with: ./ops/scripts/utility/audit-orphaned-gha-secrets.sh -u"
    echo "# Entries here are SUPPRESSED from reporting. Removing a name makes it"
    echo "# report again; deleting the object makes its entry inert."
    echo "# Presence here means 'known', NOT 'safe to delete'."
    echo "# Updated: $(date -u +%Y-%m-%d)"
    printf '%s\n' "${orphans[@]+"${orphans[@]}"}" | sort
  } > "${BASELINE}"; then
    echo "ERROR: could not write ${BASELINE}" >&2
    exit 2
  fi
  echo "Baseline updated: ${#orphans[@]} orphan(s) recorded in ${BASELINE}"
  exit 0
fi

baselined=()
if [[ -f "${BASELINE}" ]]; then
  if [[ ! -r "${BASELINE}" ]]; then
    echo "INCONCLUSIVE -- ${BASELINE} exists but is unreadable; every known" >&2
    echo "orphan would be re-reported as new." >&2
    exit 3
  fi
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"                     # tolerate CRLF
    line="${line#"${line%%[![:space:]]*}"}"  # trim leading whitespace
    line="${line%"${line##*[![:space:]]}"}"  # trim trailing whitespace
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    baselined+=("${line}")
  done < "${BASELINE}"
fi

new_orphans=()
for name in "${orphans[@]+"${orphans[@]}"}"; do
  if [[ ${SHOW_ALL} -eq 0 ]] && printf '%s\n' "${baselined[@]+"${baselined[@]}"}" | grep -qx "${name}"; then
    continue
  fi
  new_orphans+=("${name}")
done

# --- Report -----------------------------------------------------------------
if [[ ${#new_orphans[@]} -eq 0 ]]; then
  # Silent by design. Nothing changed, so there is nothing to say.
  [[ ${SHOW_ALL} -eq 1 ]] && echo "No orphans at all (${#orphans[@]} total, baseline ${#baselined[@]})."
  exit 0
fi

echo "Orphaned GitHub Actions objects at repository scope in ${REPO}:"
echo
for name in "${new_orphans[@]}"; do
  if printf '%s\n' "${stale_hits[@]+"${stale_hits[@]}"}" | grep -qx "${name}"; then
    echo "  ${name}  [referenced on a branch older than ${ACTIVE_DAYS}d]"
  else
    echo "  ${name}"
  fi
done
echo
if [[ ${SHOW_ALL} -eq 1 ]]; then
  echo "${#orphans[@]} orphaned in total (${#baselined[@]} baselined; -a shows all)."
else
  echo "${#new_orphans[@]} not in the baseline (${#orphans[@]} orphaned in total)."
fi
echo
echo "Searched the current ref and ${#ACTIVE_REFS[@]} branch(es) with commits in the"
echo "last ${ACTIVE_DAYS} days. ${#STALE_REFS[@]} older branch(es) were NOT searched."
if [[ ${#stale_hits[@]} -gt 0 ]]; then
  echo "${#stale_hits[@]} of the names above ARE referenced on one of those older"
  echo "branches, marked inline. Rebasing such a branch is routine."
fi
echo
echo "That is evidence, not an instruction:"
echo
echo "  - A secret can be unreferenced and still load-bearing -- consumed by a"
echo "    manual process, or by a workflow that is dormant rather than dead."
echo "  - Deleting a GitHub secret is irreversible; the value cannot be read back."
echo
echo "To delete any of these, follow docs/operations/gha-secret-deletion.md,"
echo "which tiers them by whether the value survives elsewhere. To accept them"
echo "as known and stop reporting them, re-run with -u."

# -a is the informational view -- it lists baselined entries by design, so it
# must not signal failure. Only genuinely NEW orphans are an exit-1 condition.
[[ ${SHOW_ALL} -eq 1 ]] && exit 0
exit 1
