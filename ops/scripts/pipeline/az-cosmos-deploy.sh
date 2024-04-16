#!/usr/bin/env bash

# Title:        az-cosmos-deploy.sh
# Description:  Helper script to provision and configure Azure CosmosDB resources
# Usage:        ./az-cosmos-deploy.sh
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
branchHashId=

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

    --allowedSubnet)
        allowedSubnet="${2}"
        shift 2
        ;;

    --analyticsWorkspaceId) # for Azure Application Insights
        analyticsWorkspaceId="${2}"
        shift 2
        ;;

    --actionGroupResourceGroup) # for Azure alerts
        actionGroupResourceGroup="${2}"
        shift 2
        ;;

    --actionGroupName) # for Azure alerts
        actionGroupName="${2}"
        shift 2
        ;;

    --branchHashId)
        branchHashId="${2}"
        shift 2
        ;;

    --slotDeploymentEnabled)
        slotDeploymentEnabled="${2}"
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

# Provision and configure primary Webapp Azure CosmosDb resource
az deployment group create -w -g "${resourceGroup}" -f ./ops/cloud-deployment/ustp-cams-cosmos.bicep \
    -p ./ops/cloud-deployment/params/ustp-cams-cosmos-containers.parameters.json \
    -p resourceGroupName="${resourceGroup}" accountName="${account}" databaseName="${database}" allowedSubnet="${allowedSubnet}" analyticsWorkspaceId="${analyticsWorkspaceId}" allowAllNetworks=${allowAllNetworks} createAlerts=${createAlerts} actionGroupResourceGroupName="${actionGroupResourceGroup}" actionGroupName="${actionGroupName}"
az deployment group create -g "${resourceGroup}" -f ./ops/cloud-deployment/ustp-cams-cosmos.bicep \
    -p ./ops/cloud-deployment/params/ustp-cams-cosmos-containers.parameters.json \
    -p resourceGroupName="${resourceGroup}" accountName="${account}" databaseName="${database}" allowedSubnet="${allowedSubnet}" analyticsWorkspaceId="${analyticsWorkspaceId}" allowAllNetworks=${allowAllNetworks} createAlerts=${createAlerts} actionGroupResourceGroupName="${actionGroupResourceGroup}" actionGroupName="${actionGroupName}"

# Provision and configure e2e CosmosDB databases and containers only if slot deployments occur. Otherwise we do not need an e2e database.
if [[ ${slotDeploymentEnabled} == 'true' ]]; then
    e2eDatabaseName="${database}-e2e"
    if [[ ${environment} != 'Main-Gov' ]]; then
        e2eDatabaseName="${e2eDatabaseName}-${branchHashId}"
    fi
    az deployment group create -w -g "${resourceGroup}" -f ./ops/cloud-deployment/ustp-cams-cosmos-e2e.bicep \
        -p ./ops/cloud-deployment/params/ustp-cams-cosmos-containers.parameters.json \
        -p resourceGroupName="${resourceGroup}" accountName="${account}" databaseName="${e2eDatabaseName}"
    az deployment group create -g "${resourceGroup}" -f ./ops/cloud-deployment/ustp-cams-cosmos-e2e.bicep \
        -p ./ops/cloud-deployment/params/ustp-cams-cosmos-containers.parameters.json \
        -p resourceGroupName="${resourceGroup}" accountName="${account}" databaseName="${e2eDatabaseName}"
fi
