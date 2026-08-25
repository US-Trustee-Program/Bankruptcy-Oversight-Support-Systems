#!/usr/bin/env bash
# Shared helper for retrying an `az deployment ...`/`az stack group ...` call
# that hits transient shared-resource-group lock contention. Source this file
# from consuming scripts; do not execute it directly.
#
# Every branch (plus main) now deploys into the SAME shared resource groups
# (CAMS-760, Option E). A deployment/stack NAME collision there can hit a
# transient conflict — retry with backoff rather than failing the whole
# pipeline run on what is usually just a timing collision. Two known
# conflict shapes: a 409 AnotherOperationInProgress on the resource group
# itself, and a (DeploymentActive) error when the SAME branch redeploys
# while its own prior deployment to that name is still active — that one
# prints no literal "409" anywhere in the CLI output, so it needs its own
# pattern. Only retries when the captured output actually looks like one of
# these two named shapes — NOT a bare "409", which is too broad: a genuine
# resource Conflict unrelated to lock contention is also sometimes reported
# as a 409, and retrying that would just resend the same parameters and hit
# the identical Conflict again, burning attempts before failing with a
# message that obscures the real cause. A genuine template/validation error
# (or an unrecognized 409) fails immediately instead of silently burning
# ~45s of pointless retries first. Output is streamed live via `tee` (not
# buffered until the command finishes) — the original single-command-
# substitution version of this function went quiet for the whole duration of
# the wrapped command and dumped everything at once on completion, which is
# fine for the sub-second shared-setup deployment this was written for, but
# reads as a hang on the considerably longer-running `az stack group create`
# calls it was extended to cover (cams-6us1n PR review). The output is also
# captured to a temp file (cleaned up on return) so it can still be pattern-
# matched afterward to decide whether to retry.
#
# NOTE: the AnotherOperationInProgress/DeploymentActive matching below was
# derived from `az deployment group create` output (the shared-setup case).
# It's a reasonable bet that `az stack group create` reports the same
# literal text for the same underlying ARM resource-group lock contention,
# but that assumption is unverified — there's no test harness for this
# script family — and worth confirming in the logs the first time it
# actually fires against a stack create.
#
# Originally specific to azure-deploy-app-shared-setup.sh's plain
# `az deployment group create` calls; extracted here so azure-deploy.sh's
# app-tier stack create and azure-deploy-network.sh's network stack create
# — which write into the identically-shared AZ_APP_RG/AZ_NETWORK_RG from
# potentially concurrent branch deploys — can tolerate the same transient
# contention instead of failing the whole CI job on it (cams-6us1n).
#
# Exports:
#   az_deploy_with_retry_func CMD... -> runs CMD, retrying up to 3 attempts
#     with exponential backoff (15s, 30s) on AnotherOperationInProgress/
#     DeploymentActive; any other failure (or exhausted attempts) returns
#     the failing exit code immediately.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: This script must be sourced, not executed directly." >&2
  exit 1
fi

az_deploy_with_retry_func() {
    local maxAttempts=3
    local attempt=1
    local delaySeconds=15
    local output
    local rc
    local outputFile
    outputFile=$(mktemp)
    # Deliberately NOT a `trap 'rm -f "${outputFile}"' RETURN`. Bash RETURN traps
    # are global, not function-scoped: the trap set here survives this function's
    # return and fires again when the CALLER returns, at which point outputFile is
    # out of scope and `set -u` aborts the script with "outputFile: unbound
    # variable". That stayed latent while every caller invoked this at top level or
    # inside a pipeline (which confines it to a subshell); wrapping the call in a
    # plain function, as azure-deploy-network.sh's deploy_network_stack_func does,
    # activates it and kills the deploy immediately after a SUCCESSFUL stack create.
    # Reproduced on bash 3.2 and 5.3. Cleaning up explicitly on each exit path is
    # the boring, scope-correct alternative.
    while true; do
        set +e
        "$@" 2>&1 | tee "${outputFile}"
        rc=${PIPESTATUS[0]}
        set -e
        output=$(<"${outputFile}")
        if [[ ${rc} -eq 0 ]]; then
            rm -f "${outputFile}"
            return 0
        fi
        if [[ ${attempt} -ge ${maxAttempts} ]] || ! grep -qi "AnotherOperationInProgress\|DeploymentActive" <<< "${output}"; then
            echo "ERROR: deployment failed after ${attempt} attempt(s)." >&2
            rm -f "${outputFile}"
            return "${rc}"
        fi
        echo "WARNING: deployment attempt ${attempt} failed with what looks like a concurrent operation in progress; retrying in ${delaySeconds}s." >&2
        sleep "${delaySeconds}"
        attempt=$((attempt + 1))
        delaySeconds=$((delaySeconds * 2))
    done
}
