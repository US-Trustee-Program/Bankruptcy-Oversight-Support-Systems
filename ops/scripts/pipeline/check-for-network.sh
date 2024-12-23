#!/usr/bin/env bash

# Title:        az-check-network.sh --resource-group <app_rg> --vnet-name <vnet_name> --is-initial-deployment
# Description:  Helper script to check if a vnet exists

initial_deployment=''

while [[ $# -gt 0 ]]; do
    case $1 in
    # default resource group name
    --resource-group)
        vnet_rg="${2}"
        shift 2
        ;;
    --vnet-name)
        vnet_name="${2}"
        shift 2
        ;;
    --is-initial-deployment)
        initial_deployment="${2}"
        shift 2
        ;;
    *)
        echo "Invalid param: ${1}"
        exit 2
        ;;
    esac
done

deployVnet='false'
vnetCount=


# shellcheck disable=SC2086 # REASON: Qoutes are necessary for pipeline
if [ $initial_deployment == "false" ]; then
    vnetCount=$(az network vnet list -g "${vnet_rg}" --query "length([?name=='${vnet_name}'])" || true)
    if [ "$vnetCount" == '1' ]; then
        deployVnet='false'
    else
        deployVnet='true'
    fi
else
    deployVnet='true'
fi

echo $deployVnet
