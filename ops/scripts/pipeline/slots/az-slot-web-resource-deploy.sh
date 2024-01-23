#!/usr/bin/env bash

# Title:        az-slot-web-resource-deploy.sh
# Description:  Helper script to provision Azure slot deployment resources for Azure webapp
# Usage:        ./az-slot-web-resource-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n webappName
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
        echo "USAGE: az-slot-web-resource-deploy.sh -h --resourceGroup resourceGroupName --webappName webappName --apiName functionappName --slotName staging"
        exit 0
        ;;
    --resourceGroup)
        app_rg="${2}"
        shift 2
        ;;
    --webappName)
        webapp_name="${2}"
        shift 2
        ;;

    --apiName)
        api_name="${2}"
        shift 2
        ;;

    --slotName)
        slot_name="${2}"
        shift 2
        ;;

    --subscription)
        subscription_id="${2}"
        shift 2
        ;;
    --network-rg)
        network_resource_group="${2}"
        shift 2
        ;;
    --vnet)
        vnet_name="${2}"
        shift 2
        ;;
    --subnet)
        subnet_name="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

# WebApp Slot Deployment and configuration
echo "Creating deployment slot for webapp: ${webapp_name}..."
az webapp deployment slot create --name "$webapp_name" --resource-group "$app_rg" --slot "$slot_name" --configuration-source "$webapp_name"

echo "Modifying app settings for deployment slot..."
az webapp config appsettings set --resource-group "${app_rg}" --name "${webapp_name}" --slot "${slot_name}" --settings CSP_API_SERVER_HOST="${api_name}.azurewebsites.us ${api_name}-${slot_name}.azurewebsites.us"

# shellcheck disable=SC2086
az webapp traffic-routing set --distribution ${slot_name}=0 --name "${webapp_name}" --resource-group "${app_rg}"

# enable vnet integration for webapp
az webapp vnet-integration add --name "${webapp_name}" --resource-group "${app_rg}" --slot "${slot_name}" \
    --subnet "/subscriptions/${subscription_id}/resourceGroups/${network_resource_group}/providers/Microsoft.Network/virtualNetworks/${vnet_name}/subnets/${subnet_name}" \
    --vnet "/subscriptions/${subscription_id}/resourceGroups/${network_resource_group}/providers/Microsoft.Network/virtualNetworks/${vnet_name}"
