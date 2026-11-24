#!/usr/bin/env bash

# Description: Helper script to add/remove GHA runner IP in Cosmos DB firewall rules
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: add-cosmos-firewall-rule.sh -g <resource_group:str> --account-name <cosmos_account:str> [--delete]

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

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
# with "PreconditionFailed: ... exclusive lock on this service". Re-read the
# current rule list on every attempt (not just the first) so a retry builds its
# new list from what's actually on the account now, rather than clobbering a
# sibling run's concurrent change with a stale snapshot.
maxAttempts=5
retryDelaySeconds=20

attempt=1
while true; do
    existingIps=$(az cosmosdb show -n "${cosmos_account}" -g "${db_rg}" --query "ipRules[].ipAddressOrRange" -o tsv 2>/dev/null | tr '\n' ',' | sed 's/,$//')

    if [[ -n "${delete}" ]]; then
        echo "Removing GHA runner IP (${agentIp}) from Cosmos DB firewall... (attempt ${attempt}/${maxAttempts})"
        newIps=$(echo "${existingIps}" | tr ',' '\n' | grep -v "^${agentIp}$" | tr '\n' ',' | sed 's/,$//' || true)
    else
        echo "Adding GHA runner IP (${agentIp}) to Cosmos DB firewall... (attempt ${attempt}/${maxAttempts})"
        if [[ -n "${existingIps}" ]]; then
            newIps="${existingIps},${agentIp}"
        else
            newIps="${agentIp}"
        fi
    fi

    if updateOutput=$(az cosmosdb update -n "${cosmos_account}" -g "${db_rg}" --ip-range-filter "${newIps}" 2>&1 1>/dev/null); then
        break
    fi

    if [[ "${updateOutput}" != *"PreconditionFailed"* ]] || [[ "${attempt}" -ge "${maxAttempts}" ]]; then
        echo "${updateOutput}" >&2
        exit 1
    fi

    echo "Cosmos DB account is locked by a concurrent operation. Retrying in ${retryDelaySeconds}s..."
    sleep "${retryDelaySeconds}"
    attempt=$((attempt + 1))
done

if [[ -n "${delete}" ]]; then
    echo "IP removed..."
else
    echo "IP added. Waiting for firewall rule to propagate..."
    sleep 60
fi
