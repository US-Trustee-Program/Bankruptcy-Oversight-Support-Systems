#!/usr/bin/env bash

# Description: Helper script to add/remove GHA runner IP in Cosmos DB firewall rules
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: add-cosmos-firewall-rule.sh -g <resource_group:str> --account-name <cosmos_account:str> [--delete]

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=ops/scripts/pipeline/_az-deploy-retry.sh
source "$SCRIPT_DIR/_az-deploy-retry.sh"

db_rg=
cosmos_account=
delete=
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        printf ""
        printf "Usage: add-cosmos-firewall-rule.sh -g <resource_group:str> --account-name <cosmos_account:str> [--delete]"
        printf ""
        exit 0
        ;;
    -g | --resource-group)
        db_rg="${2}"
        shift 2
        ;;

    --account-name)
        cosmos_account="${2}"
        shift 2
        ;;

    --delete)
        delete=true
        shift
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [[ -z "${db_rg}" || -z "${cosmos_account}" ]]; then
    printf "Error: Missing parameters. Usage: add-cosmos-firewall-rule.sh -g <resource_group:str> --account-name <cosmos_account:str>"
    exit 1
fi

agentIp=$(curl -s --retry 3 --retry-delay 30 --retry-all-errors https://api.ipify.org)

if [[ -z "${agentIp}" ]]; then
    printf "Error: Unable to determine GHA runner IP address."
    exit 1
fi

# Cosmos DB serializes account-level control-plane writes (e.g. ip-range-filter
# updates), so concurrent pipeline runs against the same account routinely collide
# with "PreconditionFailed: ... exclusive lock on this service". _az-deploy-retry.sh
# already exists for this exact class of transient Azure control-plane lock
# contention (see az-cosmos-deploy.sh's Cosmos-throttling use of it), so reuse it
# here instead of a second hand-rolled retry loop. The whole read-build-write
# sequence below is re-run on each retry (not just the write), so a retry builds
# its new list from what's on the account at retry time rather than a stale first
# read. This narrows, but does not close, the race: a write based on a read taken
# just before a sibling run's own write completes can still silently drop that
# sibling's IP, since Azure only rejects writes that literally overlap in time,
# not ones built from stale data. Closing that fully needs real mutual exclusion
# across pipeline runs, which is out of scope here.
cosmos_firewall_update_attempt_func() {
    local rawIps rc existingIps newIps

    set +e
    rawIps=$(az cosmosdb show -n "${cosmos_account}" -g "${db_rg}" --query "ipRules[].ipAddressOrRange" -o tsv 2>&1)
    rc=$?
    set -e
    if [[ ${rc} -ne 0 ]]; then
        echo "Error: failed to read current Cosmos DB firewall rules:" >&2
        echo "${rawIps}" >&2
        return "${rc}"
    fi
    existingIps=$(echo "${rawIps}" | tr '\n' ',' | sed 's/,$//')

    if [[ -n "${delete}" ]]; then
        echo "Removing GHA runner IP (${agentIp}) from Cosmos DB firewall..."
        newIps=$(echo "${existingIps}" | tr ',' '\n' | grep -v "^${agentIp}$" | tr '\n' ',' | sed 's/,$//' || true)
    else
        echo "Adding GHA runner IP (${agentIp}) to Cosmos DB firewall..."
        if [[ -n "${existingIps}" ]]; then
            newIps="${existingIps},${agentIp}"
        else
            newIps="${agentIp}"
        fi
    fi

    az cosmosdb update -n "${cosmos_account}" -g "${db_rg}" --ip-range-filter "${newIps}" 1>/dev/null
}

export AZ_DEPLOY_RETRY_PATTERN='PreconditionFailed|TooManyRequests|high rate of metadata requests'
export AZ_DEPLOY_RETRY_MAX_ATTEMPTS=5
export AZ_DEPLOY_RETRY_INITIAL_DELAY_SECONDS=20
az_deploy_with_retry_func cosmos_firewall_update_attempt_func

if [[ -n "${delete}" ]]; then
    echo "IP removed..."
else
    echo "IP added. Waiting for firewall rule to propagate..."
    sleep 60
fi
