#!/usr/bin/env bash

# Title:        az-config-pep.sh
# Description:  Helper script to provision and configure private endpoint for a slots environment
# Usage:        ./az-config-pep.sh -n app_name -g app_resource_group --network-rg network_resource_group --vnet vnet_name --snet subnet_name --subscription subscription_id

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

subscription_id=
app_name=
app_resource_group=
vnet_name=
subnet_name=
network_resource_group=
private_dns_zone=privatelink.azurewebsites.us
private_dns_zone_id=

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: ./az-config-pep.sh -n app_name -g app_resource_group --network-rg network_resource_group --vnet vnet_name --snet subnet_name --subscription subscription_id"
        exit 0
        ;;

    -n | --name)
        app_name="${2}"
        shift 2
        ;;

    -g | --resource-group)
        app_resource_group="${2}"
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

    --snet)
        subnet_name="${2}"
        shift 2
        ;;

    --dns-zone)
        private_dns_zone="${2}"
        shift 2
        ;;

    --dns-zone-id)
        private_dns_zone_id="${2}"
        shift 2
        ;;

    --subscription)
        subscription_id="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [[ -z "${subscription_id}" ]]; then
    echo "Error: Missing subscription id"
    exit 10
fi
if [[ -z "${app_name}" ]]; then
    echo "Error: Missing name of target application"
    exit 11
fi
if [[ -z "${app_resource_group}" ]]; then
    echo "Error: Missing application resource group name"
    exit 12
fi
if [[ -z "${vnet_name}" ]]; then
    echo "Error: Missing target vnet name"
    exit 13
fi
if [[ -z "${subnet_name}" ]]; then
    echo "Error: Missing target subnet name for pep resource"
    exit 14
fi
if [[ -z "${network_resource_group}" ]]; then
    echo "Error: Missing network resource group name"
    exit 15
fi

echo "Creating private endpoint resource for slot resource ${app_name}"
az network private-endpoint create \
    --connection-name pep-connection-stg-"${app_name}" \
    --name pep-stg-"${app_name}" \
    --private-connection-resource-id "/subscriptions/${subscription_id}/resourceGroups/${app_resource_group}/providers/Microsoft.Web/sites/${app_name}" \
    --resource-group "${network_resource_group}" \
    --subnet "/subscriptions/${subscription_id}/resourceGroups/${network_resource_group}/providers/Microsoft.Network/virtualNetworks/${vnet_name}/subnets/${subnet_name}" \
    --group-id sites-staging 1> /dev/null

echo "Adding pep-stg-${app_name} to existing private dns zone ${private_dns_zone}"
az network private-endpoint dns-zone-group create \
    --resource-group "${network_resource_group}" \
    --endpoint-name pep-stg-"${app_name}" \
    --name zone-group \
    --private-dns-zone "${private_dns_zone_id}" \
    --zone-name "${private_dns_zone}"
