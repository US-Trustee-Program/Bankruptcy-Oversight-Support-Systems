#!/bin/bash

# Title:        az-app-deploy.sh
# Description:  Helper script to deploy webapp build artifact to existing Azure site
# Usage:        ./az-app-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n webappName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-slot-deploy.sh -h -g resourceGroupName --webappName webappName --apiName functionappName --slot staging"
        shift
        ;;
    -g | --resourceGroup)
        app_rg="${2}"
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

    --kvReferenceId)
        kv_ref_id="${2}"
        shift 2
        ;;
    --sqlReferenceId)
        sql_ref_id="${2}"
        shift 2
        ;;
    --cosmosReferenceId)
        cosmos_ref_id="${2}"
        shift 2
        ;;
    --storageAccKey)
        storage_acc_key="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done


# az webapp config show --name $webapp_name --resource-group $app_rg --query name -o tsv


#Function App Slot Deployment and Configuration
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az functionapp deployment slot create --name $api_name --resource-group $app_rg --slot $slot_name --configuration-source $api_name
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az deployment group create --resource-group $app_rg --template-file ../../cloud-deployment/lib/slots/backend-api-slot-deploy.bicep --parameters nodeApiName=$api_name -o json --query properties.outputs | tee outputs.json
echo outputs.json | jq -r .storageAccountName
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az webapp config appsettings set --resource-group $app_rg  --name $api_name --slot $slot_name --settings "AzureWebJobsStorage=DefaultEndpointsProtocol=https;AccountName=$( ! ! );EndpointSuffix=core.usgovcloudapi.net;AccountKey=${storage_acc_key}"
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az functionapp identity assign -g MyResourceGroup -n $api_name --slot $slot_name --identities $kv_ref_id $sql_ref_id $cosmos_ref_id
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az functionapp update --resource-group $app_rg  --name $api_name --slot $slot_name --set keyVaultReferenceIdentity=$kv_ref_id



# WebApp Slot Deployment and configuration
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az webapp deployment slot create --name $webapp_name --resource-group $app_rg --slot $slot_name --configuration-source $webapp_name
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az deployment group create --resource-group $app_rg --template-file ../../cloud-deployment/lib/slots/frontend-slot-deploy.bicep --parameters nodeApiName=$api_name
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az webapp update --resource-group $app_rg  --name $webapp_name --slot $slot_name --set CSP_API_SERVER_HOST=$api_name-$slot_name.azurewebsites.us
