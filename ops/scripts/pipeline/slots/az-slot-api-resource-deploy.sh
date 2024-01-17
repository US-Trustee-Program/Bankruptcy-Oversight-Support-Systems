#!/usr/bin/env bash

# Title:        az-slot-api-resource-deploy.sh
# Description:  Helper script to provision Azure slot deployment resources for Azure functionapp api
# Usage:        ./az-slot-api-resource-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n webappName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

sql_id_name=''

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-slot-api-resource-deploy.sh -h --resourceGroup resourceGroupName --idResourceGroup managedIdResourceGroup --webappName webappName --apiName functionappName --slotName staging --kvIdName kvManagedIdName --sqlIdName sqlManagedIdName --cosmosIdName cosmosManagedIdName --storageAccName apiStorageAccountName"
        exit 0
        ;;
    --resourceGroup)
        app_rg="${2}"
        shift 2
        ;;

    --idResourceGroup)
        id_rg="${2}"
        shift 2
        ;;

    --apiName)
        api_name="${2}"
        shift 2
        ;;

    --webappName)
        webapp_name="${2}"
        shift 2
        ;;

    --slotName)
        slot_name="${2}"
        shift 2
        ;;

    --kvIdName)
        kv_id_name="${2}"
        shift 2
        ;;
    --sqlIdName)
        sql_id_name="${2}"
        shift 2
        ;;
    --cosmosIdName)
        cosmos_id_name="${2}"
        shift 2
        ;;
    --storageAccName)
        storage_acc_name="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

#Function App Slot Deployment and Configuration
echo "Creating Storage account for Node API Slot..."
az storage account create --name "$storage_acc_name" --resource-group "$app_rg" -o json
storage_acc_key=$(az storage account keys list -g "$app_rg" --account-name "$storage_acc_name" --query '[0].value' -o tsv)

echo "Creating Node API Staging Slot..."
az functionapp deployment slot create --name "$api_name" --resource-group "$app_rg" --slot "$slot_name" --configuration-source "$api_name"

echo "Updating Node API Slot Configuration with new storage account..."
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az functionapp config appsettings set --resource-group "$app_rg"  --name "$api_name" --slot "$slot_name" --settings AzureWebJobsStorage="DefaultEndpointsProtocol=https;AccountName=${storage_acc_name};EndpointSuffix=core.usgovcloudapi.net;AccountKey=${storage_acc_key}" --slot-settings AzureWebJobsStorage=true

echo "Setting CORS Allowed origins for the API..."
az functionapp cors add -g "$app_rg" --name "$api_name" --slot "$slot_name" --allowed-origins "https://${webapp_name}-${slot_name}.azurewebsites.us"

echo "Assigning managed Identities..."
# Identities occasionally come through with improper id for usage here, this constructs that
kv_ref_id=$(az identity list -g "$id_rg" --query "[?name == '$kv_id_name'].id" -o tsv)
cosmos_ref_id=$(az identity list -g "$id_rg" --query "[?name == '$cosmos_id_name'].id" -o tsv)
identities="$kv_ref_id $cosmos_ref_id"
# In USTP we do not use managed ID for SQL, we might not have this
if [[ ${sql_id_name} != null && ${sql_id_name} != '' ]]; then
    sql_ref_id=$(az identity list -g "$id_rg" --query "[?name == '$sql_id_name'].id" -o tsv)
    identities="$identities $sql_ref_id"
fi

# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --identities
az functionapp identity assign -g "$app_rg" -n "$api_name" --slot "$slot_name" --identities $identities

echo "Setting KeyVaultReferenceIdentity..."
az functionapp update --resource-group "$app_rg"  --name "$api_name" --slot "$slot_name" --set keyVaultReferenceIdentity="$kv_ref_id"

# shellcheck disable=SC2086
az webapp traffic-routing set --distribution ${slot_name}=0 --name "${api_name}" --resource-group "${app_rg}"
