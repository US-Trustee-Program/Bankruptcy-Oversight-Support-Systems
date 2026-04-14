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

existingIps=$(az cosmosdb show -n "${cosmos_account}" -g "${db_rg}" --query "ipRules[].ipAddressOrRange" -o tsv 2>/dev/null | tr '\n' ',' | sed 's/,$//')

if [[ -n "${delete}" ]]; then
    echo "Removing GHA runner IP (${agentIp}) from Cosmos DB firewall..."
    newIps=$(echo "${existingIps}" | tr ',' '\n' | grep -v "^${agentIp}$" | tr '\n' ',' | sed 's/,$//' || true)
    az cosmosdb update -n "${cosmos_account}" -g "${db_rg}" --ip-range-filter "${newIps}" 1>/dev/null
    echo "IP removed..."
else
    echo "Adding GHA runner IP (${agentIp}) to Cosmos DB firewall..."
    if [[ -n "${existingIps}" ]]; then
        newIps="${existingIps},${agentIp}"
    else
        newIps="${agentIp}"
    fi
    az cosmosdb update -n "${cosmos_account}" -g "${db_rg}" --ip-range-filter "${newIps}" 1>/dev/null
    echo "IP added. Waiting for firewall rule to propagate..."
    sleep 60
fi
