#!/bin/bash

# Title:        az-delete-branch-resources.sh
# Description:  Clean up USTP CAMS Azure resources provisioned for a development branch deployment by hash id.
# Prerequisite:
#               - Azure CLI
# Usage:        ./az-delete-branch-resources.sh <hash_id> <ignore>
#
# Exitcodes
# ==========
# 0   No error
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

function error() {
    local msg=$1
    local code=$2
    echo "ERROR: ${msg}" >>/dev/stderr
    exit "${code}"
}

hash_id=$1 # Short hash id generated based on the branch name
ignore=$2  # if true, ignore validation

echo "Begin clean up of Azure resources for ${hash_id}"

# Check that resource groups exists
app_rg="rg-cams-app-dev-${hash_id}"
network_rg="rg-cams-network-dev-${hash_id}"
rgAppExists=$(az group exists -n "${app_rg}")
rgNetExists=$(az group exists -n "${network_rg}")
if [[ ${rgAppExists} != "true" || ${rgNetExists} != "true" ]]; then
    if [[ "${ignore}" != "true" ]]; then
        error "Expected resource group missing." 11
    fi
fi

# Disconnect VNET integration from App Service components prior to deleting resources
if [[ "${rgAppExists}" == "true" ]]; then
    echo "Start disconnecting VNET integration"
    webapp="ustp-cams-dev-${hash_id}-webapp"
    az webapp vnet-integration remove -g "${app_rg}" -n "${webapp}"
    functionapp="ustp-cams-dev-${hash_id}-node-api"
    az functionapp vnet-integration remove -g "${app_rg}" -n "${functionapp}"
    echo "Completed disconnecting VNET integration"
fi

# Delete by resource group
if [[ "${rgAppExists}" == "true" ]]; then
    echo "Start deleting resource group ${app_rg}"
    az group delete -n "${app_rg}" --yes
fi

if [[ "${rgNetExists}" == "true" ]]; then
    echo "Start deleting resource group ${network_rg}"
    az group delete -n "${network_rg}" --yes
fi

echo "Completed resource clean up operations."
