#!/usr/bin/env bash
# Shared helper for discovering Azure branch-deployment Deployment Stacks by
# their isBranchDeployment/branchName/branchHashId tags (CAMS-760 Option E /
# Slice 2 tagging scheme: both the network and app tiers carry these same
# three tags). Source this file from a workflow's `run:` block; do not
# execute it directly.
#
# `check`'s bulk nightly discovery, `check`'s single-target discovery (for
# `workflow_dispatch`/`delete`), and `assert-clean-state`'s post-cleanup
# verification all need this SAME query. `assert-clean-state` exists
# specifically so nothing has to trust `clean-up`'s self-reported success --
# that guarantee only holds if its own discovery query can't silently drift
# from `check`'s, which is why this is one shared function rather than three
# hand-rolled copies.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "ERROR: This script must be sourced, not executed directly." >&2
    exit 1
fi

# Lists tagged branch-deployment stacks across the network and app RGs,
# merged into one JSON array of {name, branchName, branchHashId}.
#
#   find_branch_stacks OUT_VAR NETWORK_RG APP_RG [HASH_ID]
#
# Omit HASH_ID to list every tagged branch deployment stack in both RGs
# (excluding any missing the branchHashId tag entirely, since a stack that
# somehow lost it can't be matched to a branch anyway); pass it to narrow to
# one hash. Callers own all filtering/shaping past this point (hex-hash
# validation, excluding `main`, dedup, etc.) since that differs per caller.
function find_branch_stacks() {
    local _fbs_outVar=$1 _fbs_networkRg=$2 _fbs_appRg=$3 _fbs_hashId=${4:-}

    local _fbs_filter="tags.isBranchDeployment == 'true'"
    if [[ -n "${_fbs_hashId}" ]]; then
        _fbs_filter+=" && tags.branchHashId == '${_fbs_hashId}'"
    else
        _fbs_filter+=" && tags.branchHashId != null"
    fi

    local _fbs_network _fbs_app _fbs_merged
    _fbs_network=$(_fbs_list_with_retry "${_fbs_networkRg}" "${_fbs_filter}")
    _fbs_app=$(_fbs_list_with_retry "${_fbs_appRg}" "${_fbs_filter}")
    _fbs_merged=$(jq -c -n --argjson net "${_fbs_network}" --argjson app "${_fbs_app}" '$net + $app')
    printf -v "${_fbs_outVar}" '%s' "${_fbs_merged}"
}

# Retries a single `az stack group list` call up to 3 attempts (5s, 10s
# backoff) on any failure before giving up. `list` is a read-only GET, so --
# unlike a mutating `az deployment`/`az stack group create` call (see
# _az-deploy-retry.sh, which only retries specific named conflict shapes) --
# a blind retry on any failure can't double-apply a side effect, so there's
# no need to pattern-match the error first.
#
# A zero exit code isn't enough on its own: az has occasionally been observed
# to print a non-JSON notice (e.g. a one-time preview/extension message) to
# stdout instead of stderr while still exiting 0, which produced stdout that
# downstream `jq --argjson` calls rejected with an opaque "invalid JSON text"
# error and no indication of which call or RG was the culprit (CAMS-884:
# assert-clean-state failed this way with no retry-warning logged at all).
# Validating the JSON shape here, with the SAME retry budget as an outright
# `az` failure, means a one-off case like that self-heals instead of crashing
# the whole step, and a persistent case logs the offending output instead of
# just a generic jq parse error.
#
# The validation requires stdout decode to EXACTLY one JSON array, not merely
# "parses as JSON": `jq -e .` alone would accept a lone object/string/number,
# or a stream of several JSON texts concatenated (e.g. a stray notice that
# happens to itself be valid JSON, followed by the real array) as success,
# silently handing a malformed shape to callers instead of retrying it.
#
# Echoes the validated array (reserialized by jq, compact) on success. A
# persistently-failing call still aborts the calling step via
# `set -euo pipefail`, same as an unretried call would, just after the retry
# budget is spent.
function _fbs_list_with_retry() {
    local _fbs_rg=$1 _fbs_filter=$2
    local _fbs_maxAttempts=3 _fbs_delaySeconds=5 _fbs_attempt=1
    local _fbs_rc _fbs_stdout _fbs_stderrFile _fbs_stderrText _fbs_failReason _fbs_validated

    while true; do
        # stderr captured to a FILE, not merged into stdout: stdout must stay
        # pure JSON for the caller's `jq` to parse on success.
        _fbs_stderrFile=$(mktemp)
        set +e
        _fbs_stdout=$(az stack group list -g "${_fbs_rg}" --query "[?${_fbs_filter}].{name:name, branchName:tags.branchName, branchHashId:tags.branchHashId}" -o json 2>"${_fbs_stderrFile}")
        _fbs_rc=$?
        set -e
        _fbs_stderrText=$(cat "${_fbs_stderrFile}")
        rm -f "${_fbs_stderrFile}"

        if [[ ${_fbs_rc} -eq 0 ]]; then
            if _fbs_validated=$(jq -ce '
                if type != "array" then
                    error("expected a JSON array, got " + type)
                elif (try input catch null) != null then
                    error("multiple JSON values in output, expected exactly one array")
                else
                    .
                end
            ' <<<"${_fbs_stdout}" 2>/dev/null); then
                printf '%s' "${_fbs_validated}"
                return 0
            fi
            _fbs_rc=1
            _fbs_failReason="exit 0 but stdout was not a single JSON array: ${_fbs_stdout}"
        else
            _fbs_failReason="${_fbs_stderrText}"
        fi

        if [[ ${_fbs_attempt} -ge ${_fbs_maxAttempts} ]]; then
            echo "${_fbs_failReason}" >&2
            return "${_fbs_rc}"
        fi
        echo "WARNING: 'az stack group list -g ${_fbs_rg}' attempt ${_fbs_attempt} failed (${_fbs_failReason}); retrying in ${_fbs_delaySeconds}s." >&2
        sleep "${_fbs_delaySeconds}"
        _fbs_attempt=$((_fbs_attempt + 1))
        _fbs_delaySeconds=$((_fbs_delaySeconds * 2))
    done
}
