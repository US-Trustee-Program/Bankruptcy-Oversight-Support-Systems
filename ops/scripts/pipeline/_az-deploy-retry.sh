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
# ~45s of pointless retries first. Output is captured (not streamed live) so
# it can be inspected before deciding whether to retry, then echoed in full
# either way so it's still visible in CI logs.
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
    while true; do
        set +e
        output=$("$@" 2>&1)
        rc=$?
        set -e
        echo "${output}"
        if [[ ${rc} -eq 0 ]]; then
            return 0
        fi
        if [[ ${attempt} -ge ${maxAttempts} ]] || ! grep -qi "AnotherOperationInProgress\|DeploymentActive" <<< "${output}"; then
            echo "ERROR: deployment failed after ${attempt} attempt(s)." >&2
            return 1
        fi
        echo "WARNING: deployment attempt ${attempt} failed with what looks like a concurrent operation in progress; retrying in ${delaySeconds}s." >&2
        sleep "${delaySeconds}"
        attempt=$((attempt + 1))
        delaySeconds=$((delaySeconds * 2))
    done
}
