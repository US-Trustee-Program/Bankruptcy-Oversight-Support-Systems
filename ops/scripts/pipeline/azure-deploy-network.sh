#!/usr/bin/env bash

# Title:        azure-deploy-network.sh
# Description:  Deploy the USTP CAMS network resources (vnet, subnets, private DNS
#               zone) into the network resource group. For branch deployments the
#               network resources are deployed as an Azure Deployment Stack so they
#               can be torn down as a unit without deleting the resource group
#               (CAMS-760, Option E). For main the resources are deployed with a
#               plain resource-group deployment (behavior preserved).
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

deployment_file=''
network_rg=''
stack_name=''
vnet_name=''
deploy_vnet=false
location=''
is_branch_deployment=false
branch_name=''
branch_hash_id=''
extra_parameters=''

function az_vnet_exists_func() {
    local rg=$1
    local vnetName=$2
    count=$(az network vnet list -g "${rg}" --query "length([?name=='${vnetName}'])" 2>/dev/null)
    if [[ ${count} -eq 0 ]]; then
        echo false
    else
        echo true
    fi
}

while [[ $# -gt 0 ]]; do
    case $1 in
    -f | --file)
        deployment_file="${2}"
        shift 2
        ;;
    --networkResourceGroupName)
        network_rg="${2}"
        shift 2
        ;;
    --stackName)
        stack_name="${2}"
        shift 2
        ;;
    --virtualNetworkName)
        vnet_name="${2}"
        shift 2
        ;;
    --deployVnet)
        deploy_vnet="${2}"
        shift 2
        ;;
    -l | --location)
        location="${2}"
        shift 2
        ;;
    --isBranchDeployment)
        is_branch_deployment="${2}"
        shift 2
        ;;
    --branchName)
        branch_name="${2}"
        shift 2
        ;;
    --branchHashId)
        branch_hash_id="${2}"
        shift 2
        ;;
    # Space-delimited "key=value" bicep parameters passed straight through
    -p | --parameters)
        extra_parameters="${2}"
        shift 2
        ;;
    *)
        echo "Exit on param: ${1}"
        exit 2
        ;;
    esac
done

if [[ -z "${deployment_file}" || -z "${network_rg}" || -z "${stack_name}" || -z "${vnet_name}" || -z "${location}" ]]; then
    echo "Error: --file, --networkResourceGroupName, --stackName, --virtualNetworkName and --location are required"
    exit 10
fi

deployment_parameters="stackName=${stack_name} networkResourceGroupName=${network_rg} virtualNetworkName=${vnet_name} location=${location}"
if [[ -n "${extra_parameters}" ]]; then
    deployment_parameters="${deployment_parameters} ${extra_parameters}"
fi

# Deploy the vnet when explicitly requested or when it does not yet exist. This
# mirrors the previous conditional in azure-deploy.sh so behavior is unchanged.
if [[ "$(az_vnet_exists_func "${network_rg}" "${vnet_name}")" != true || "${deploy_vnet}" == true ]]; then
    deployment_parameters="${deployment_parameters} deployVnet=true"
fi

if [[ "${is_branch_deployment}" == "true" ]]; then
    echo "Deploying network resources as deployment stack ${stack_name}-network in ${network_rg}"
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az stack group create \
        --name "${stack_name}-network" \
        --resource-group "${network_rg}" \
        --template-file "${deployment_file}" \
        --parameters ${deployment_parameters} \
        --action-on-unmanage deleteResources \
        --deny-settings-mode none \
        --tag isBranchDeployment=true branchName="${branch_name}" branchHashId="${branch_hash_id}" \
        --yes
else
    echo "Deploying network resources to ${network_rg} (resource-group deployment)"
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -w -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
fi
