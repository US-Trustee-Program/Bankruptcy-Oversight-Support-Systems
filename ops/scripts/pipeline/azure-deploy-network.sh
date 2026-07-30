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
deploy_dns=true
location=''
is_branch_deployment=false
branch_name=''
branch_hash_id=''
extra_parameters=''

function az_vnet_exists_func() {
    local rg=$1
    local vnetName=$2
    local count
    # Let a real Azure CLI failure (auth expiry, throttling, wrong subscription)
    # propagate and fail the script loudly, rather than silently reading as
    # "vnet missing" — a flaky call here would otherwise nondeterministically
    # affect the deployVnet decision below.
    count=$(az network vnet list -g "${rg}" --query "length([?name=='${vnetName}'])")
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
    --deployDns)
        deploy_dns="${2}"
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

requiredParams=("deployment_file:--file" "network_rg:--networkResourceGroupName" "stack_name:--stackName" "vnet_name:--virtualNetworkName" "location:--location")
missingParams=()
for entry in "${requiredParams[@]}"; do
    varName="${entry%%:*}"
    flagName="${entry#*:}"
    if [[ -z "${!varName}" ]]; then
        missingParams+=("${flagName}")
    fi
done
if [[ ${#missingParams[@]} -gt 0 ]]; then
    echo "Error: missing required parameter(s): ${missingParams[*]}"
    exit 10
fi

deployment_parameters="stackName=${stack_name} networkResourceGroupName=${network_rg} virtualNetworkName=${vnet_name} location=${location} deployDns=${deploy_dns}"
if [[ -n "${extra_parameters}" ]]; then
    deployment_parameters="${deployment_parameters} ${extra_parameters}"
fi

# Deploy the vnet when explicitly requested, when it does not yet exist, or
# unconditionally for branches (PR #2757 review, verified BLOCKER): branches
# deploy this as a Deployment Stack with --action-on-unmanage deleteResources.
# A resource that was stack-managed on a prior deploy but is absent from the
# CURRENT template's resources is treated as unmanaged and gets deleted.
# check-for-network.sh reports deployVnet=false once the vnet already exists —
# true for every deploy after a branch's first — so omitting the vnet module
# here on push #2+ would delete the branch's own vnet out from under it (or
# fail with InUseSubnetCannotBeDeleted once app resources are attached — the
# exact class of failure this feature exists to prevent). The underlying
# vnet.bicep PUT is idempotent, so always including it for branches costs
# nothing. Main is unaffected — it's never stacked, so its existing
# existence-check behavior is preserved unchanged.
if [[ "${is_branch_deployment}" == "true" || "$(az_vnet_exists_func "${network_rg}" "${vnet_name}")" != true || "${deploy_vnet}" == true ]]; then
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
    # Preview then apply — matches the established pattern elsewhere in this
    # repo (azure-deploy.sh's az_deploy_func, azure-deploy-rg.sh's
    # az_deploy_func). PR #2757 review, verified BLOCKER: an earlier commit on
    # this branch removed the real (non -w) apply call believing it was a
    # redundant duplicate of the preview — `-w`/`--what-if` only previews
    # changes and never applies them, so main's network resources were never
    # actually being deployed by this script. Restored here.
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -w -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
fi
