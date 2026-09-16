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
# Usage
#   From the root directory:
#     ./ops/scripts/utility/audit-orphaned-gha-secrets.sh [-u|-a|-h]
#
# Exit codes
#   0  no new orphans (silent success)
#   1  new orphans found, not present in the baseline
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
  echo "a     Report ALL orphans, including baselined ones."
  echo "h     Print this Help and exit."
  echo
  echo "environment:"
  echo "GH_REPO       owner/repo to audit. Defaults to the US-Trustee-Program repo."
  echo "ACTIVE_DAYS   branch recency window for reference checking (default 90)."
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
scan_prepare() {
  local f errfile out
  SCAN_FILES=()
  errfile=$(mktemp) || return 1
  while IFS= read -r f; do
    [[ -n "${f}" && -r "${f}" ]] && SCAN_FILES+=("${f}")
  done < <(find -L .github -type f 2>"${errfile}")
  out=$(head -3 "${errfile}"); rm -f "${errfile}"
  [[ -z "${out}" ]] || { err "traversing .github/ failed: ${out}"; return 1; }
  [[ ${#SCAN_FILES[@]} -gt 0 ]]
}

ref_pattern() { printf '(secrets|vars)[[:space:]]*\\.[[:space:]]*%s([^A-Za-z0-9_]|$)' "$1"; }

# Every reference is collected in ONE pass per ref, using a single alternation
# over all candidate names, rather than one git grep per name per branch. The
# naive form is ~n_names x n_branches git invocations -- around a thousand here,
# slow enough that nobody would leave it in a scheduled job.
ACTIVE_BRANCH_COUNT=0
collect_references() {  # collect_references <NAME1|NAME2|...>
  local alt="$1" ref ts cutoff
  cutoff=$(( $(date +%s) - ACTIVE_DAYS * 86400 ))
  grep -hoiE "(secrets|vars)[[:space:]]*\.[[:space:]]*(${alt})([^A-Za-z0-9_]|$)" \
    "${SCAN_FILES[@]}" 2>/dev/null
  while read -r ref ts; do
    [[ -z "${ref}" || "${ref}" == *"/HEAD" ]] && continue
    [[ "${ts}" -lt ${cutoff} ]] && continue
    ACTIVE_BRANCH_COUNT=$((ACTIVE_BRANCH_COUNT + 1))
    git grep -hoiE "(secrets|vars)[[:space:]]*\.[[:space:]]*(${alt})([^A-Za-z0-9_]|$)" \
      "${ref}" -- .github/ 2>/dev/null
  done < <(git for-each-ref --format='%(refname:short) %(committerdate:unix)' refs/remotes/origin)
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
if [[ ${errors} -gt 0 ]]; then
  echo "INCONCLUSIVE -- preconditions failed; not reporting a clean result." >&2
  exit 3
fi

# Proves the matcher works before any result is trusted: a pattern that silently
# matches nothing would report every live secret as an orphan.
probe=$(mktemp -d) || exit 3
trap 'rm -rf "${probe}"' EXIT
# shellcheck disable=SC2016  # ${{ }} is a GitHub Actions literal, not a shell expansion
printf 'a: ${{ secrets.probe_name }}\n' > "${probe}/p.yml"
if ! grep -qiE "$(ref_pattern PROBE_NAME)" "${probe}/p.yml"; then
  err "matcher self-test failed; results would be meaningless."
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

# --- Classify ---------------------------------------------------------------
live_all=$(printf '%s\n%s' "${live_secrets}" "${live_vars}" | grep -v '^$' | sort -u)
# Read into an array rather than relying on word splitting: mapfile is bash 4+
# and macOS still ships bash 3.2, so a read loop is the portable form.
live_arr=()
while IFS= read -r n; do [[ -n "${n}" ]] && live_arr+=("${n}"); done <<< "${live_all}"
alt=$(printf '%s|' "${live_arr[@]}"); alt="${alt%|}"
if [[ -z "${alt}" ]]; then
  echo "INCONCLUSIVE -- repository scope returned no secrets or variables." >&2
  exit 3
fi

seen=$(collect_references "${alt}")

orphans=()
while read -r name; do
  [[ -z "${name}" ]] && continue
  # Cheap in-memory check against the single collected blob.
  grep -qiE "\.[[:space:]]*${name}([^A-Za-z0-9_]|$)" <<< "${seen}" && continue
  orphans+=("${name}")
done <<< "${live_all}"

if [[ ${UPDATE_BASELINE} -eq 1 ]]; then
  {
    echo "# Known-accepted orphaned GitHub Actions secrets and variables."
    echo "# Regenerate with: ./ops/scripts/utility/audit-orphaned-gha-secrets.sh -u"
    echo "# Entries here are SUPPRESSED from reporting. Removing a name makes it"
    echo "# report again; deleting the object makes its entry inert."
    echo "# Presence here means 'known', NOT 'safe to delete'."
    echo "# Updated: $(date -u +%Y-%m-%d)"
    printf '%s\n' "${orphans[@]+"${orphans[@]}"}" | sort
  } > "${BASELINE}"
  echo "Baseline updated: ${#orphans[@]} orphan(s) recorded in ${BASELINE}"
  exit 0
fi

baselined=()
if [[ -f "${BASELINE}" ]]; then
  while IFS= read -r line; do
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
printf '  %s\n' "${new_orphans[@]}"
echo
echo "${#new_orphans[@]} not in the baseline (${#orphans[@]} orphaned in total)."
echo
echo "Nothing references these on the current ref or on any branch with commits"
echo "in the last ${ACTIVE_DAYS} days. That is evidence, not an instruction:"
echo
echo "  - A secret can be unreferenced and still load-bearing -- consumed by a"
echo "    manual process, or by a workflow that is dormant rather than dead."
echo "  - Deleting a GitHub secret is irreversible; the value cannot be read back."
echo
echo "To delete any of these, follow docs/operations/gha-secret-deletion.md,"
echo "which tiers them by whether the value survives elsewhere. To accept them"
echo "as known and stop reporting them, re-run with -u."
exit 1
