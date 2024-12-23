#!/usr/bin/env bash

# Title:        az-check-network.sh --resource-group <app_rg> --vnet-name <vnet_name>
# Description:  Helper script to check if a vnet exists


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
    *)
        echo "Invalid param: ${1}"
        exit 2
        ;;
    esac
done

vnetExists='false'

vnetCount=$(az network vnet list -g "${vnet_rg}" --query "length([?name=='${vnet_name}'])" || true)

if [ "$vnetCount" == '1' ]; then
    vnetExists='true'
fi

echo $vnetExists
