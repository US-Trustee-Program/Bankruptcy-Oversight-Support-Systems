#!/usr/bin/env bash

# Title:        az-cosmos-deploy.sh
# Description:  Helper script to provision and configure Azure CosmosDB resources
# Usage:        ./az-cosmos-mongo-deploy.sh
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

# defaults for optional parameters
analyticsWorkspaceId=
actionGroupResourceGroup=
actionGroupName=
branchHashId=''
allowedIps='[]'

while [[ $# -gt 0 ]]; do
    case $1 in
    -g | --resourceGroup)
        resourceGroup="${2}"
        shift 2
        ;;

    --accountName)
        account="${2}"
        shift 2
        ;;

    --databaseName)
        database="${2}"
        shift 2
        ;;

    --environmentName)
        environment="${2}"
        shift 2
        ;;

    --allowedNetworks)
        allowedNetworks="${2}"
        shift 2
        ;;

    --keyVaultName)
        keyVaultName="${2}"
        shift 2
        ;;

    --kvResourceGroup)
        kvResourceGroup="${2}"
        shift 2
        ;;

    --createAlerts)
        createAlerts="${2}"
        shift 2
        ;;

    --actionGroupResourceGroup)
        actionGroupResourceGroup="${2}"
        shift 2
        ;;

    --actionGroupName)
        actionGroupName="${2}"
        shift 2
        ;;

    --analyticsWorkspaceId)
        analyticsWorkspaceId="${2}"
        shift 2
        ;;

    --branchHashId)
        branchHashId="${2}"
        shift 2
        ;;

    --allowedIps)
        allowedIps="${2}"
        shift 2
        ;;

    *)
        echo "$1"
        exit 2 # error on unknown flag/switch
        ;;
    esac
done


allowAllNetworks=false
if [[ ${environment} != 'Main-Gov' ]]; then
    allowAllNetworks=true
fi

createAlerts=false
if [[ ${environment} == 'Main-Gov' ]]; then
    createAlerts=true
fi


e2eDatabaseName="${database}-e2e"
if [[ ${environment} != 'Main-Gov' ]]; then
    e2eDatabaseName="${e2eDatabaseName}-${branchHashId}"
fi


# shellcheck disable=SC2086 # REASON: Qoutes render the CreateAlertsproperty unusable
az deployment group create -w -g "${resourceGroup}" -f ./ops/cloud-deployment/ustp-cams-cosmos.bicep \
    -p ./ops/cloud-deployment/params/ustp-cams-mongo-collections.parameters.json \
    -p resourceGroupName="${resourceGroup}" accountName="${account}" databaseName="${database}" allowedNetworks="${allowedNetworks}" allowedIps="${allowedIps}" analyticsWorkspaceId="${analyticsWorkspaceId}" allowAllNetworks="${allowAllNetworks}" keyVaultName="${keyVaultName}" kvResourceGroup="${kvResourceGroup}" createAlerts=${createAlerts} actionGroupResourceGroupName="${actionGroupResourceGroup}" actionGroupName="${actionGroupName}" e2eDatabaseName="${e2eDatabaseName}" deployE2eDatabase=true

# shellcheck disable=SC2086 # REASON: Qoutes render the CreateAlerts property unusable
az deployment group create -g "${resourceGroup}" -f ./ops/cloud-deployment/ustp-cams-cosmos.bicep \
    -p ./ops/cloud-deployment/params/ustp-cams-mongo-collections.parameters.json \
    -p resourceGroupName="${resourceGroup}" accountName="${account}" databaseName="${database}" allowedNetworks="${allowedNetworks}" allowedIps="${allowedIps}" analyticsWorkspaceId="${analyticsWorkspaceId}" allowAllNetworks="${allowAllNetworks}" keyVaultName="${keyVaultName}" kvResourceGroup="${kvResourceGroup}" createAlerts=${createAlerts} actionGroupResourceGroupName="${actionGroupResourceGroup}" actionGroupName="${actionGroupName}" e2eDatabaseName="${e2eDatabaseName}" deployE2eDatabase=true
