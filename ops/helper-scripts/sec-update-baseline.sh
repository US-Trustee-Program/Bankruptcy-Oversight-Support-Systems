#!/usr/bin/env bash

# Description: Helper script to update Veracode baseline file on the Azure Storage account from an existing modified baseline file. Updates should be discussed with the team and agreed on.
# Prerequisite:
#   - Azure CLI
#   - Retrieve latest baseline file from Azure storage account
#   - Logged in account has permissions to Azure storage account
# Usage: sec-update-baseline.sh <resource_group_name:str> <storage_account_name:str> <container_name:str> <baseline_file_path:str>

set -eou pipefail

function printUsageFunc() {
    echo "USAGE: sec-update-baseline.sh <resource_group_name:str> <storage_account_name:str> <container_name:str> <baseline_file_path:str>"
}

function updateFunc() {
    local resourceGroup=$1
    local storageAccountName=$2
    local containerName=$3
    local baselineFilePath=$4
    local destFileName=results-latest.json
    local key=""
    key=$(az storage account keys list -g "${resourceGroup}" -n "${storageAccountName}" --query '[0].value' -o tsv)
    az storage blob upload --account-name "${storageAccountName}" --account-key "$key" -f "${baselineFilePath}" -c "${containerName}" -n $destFileName --overwrite
}

if (($# != 4)); then
    echo "Missing required arguments"
    printUsageFunc
    exit 1
fi

resourceGroup=$1
storageAccountName=$2
containerName=$3
baselineFilePath=$4

if [ ! -f "${baselineFilePath}" ]; then
    echo "Missing file at ${baselineFilePath}"
    exit 1
fi

updateFunc "${resourceGroup}" "${storageAccountName}" "${containerName}" "${baselineFilePath}"
