#!/usr/bin/env bash

# Title:        az-cosmo-add-vnet-rule.sh
# Description:  Helper script to add CosmoDb vnet rule by subnet name, vnet name, and resource group.
# Usage:        az-cosmo-add-vnet-rule.sh --networkResourceGroup rg-network --vnetName vnet-ustp --subnetName snet-ustp-node --databaseResourceGroup rg-database --accountName cosmo-dev-01

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

while [[ $# > 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-cosmo-add-vnet-rule.sh --networkResourceGroup rg-network --vnetName vnet-ustp --subnetName snet-ustp-node --databaseResourceGroup rg-database --accountName cosmo-dev-01"
        exit 0
        shift
        ;;

    --networkResourceGroup)
        network_rg="${2}"
        shift 2
        ;;

    --databaseResourceGroup)
        database_rg="${2}"
        shift 2
        ;;

    --accountName)
        account_name="${2}"
        shift 2
        ;;

    --vnetName)
        vnet_name="${2}"
        shift 2
        ;;

    --subnetName)
        subnet_name="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

subnetId=$(az network vnet subnet show -g ${network_rg} --vnet-name ${vnet_name} -n ${subnet_name} -o tsv --query "id")
az cosmosdb network-rule add --resource-group ${database_rg} --name ${account_name} --subnet ${subnetId} --ignore-missing-endpoint true -o tsv --query "length(virtualNetworkRules)"
