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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/pipeline/_network-stackname.sh
source "$SCRIPT_DIR/_network-stackname.sh"

deployment_file=''
network_rg=''
stack_name=''
vnet_name=''
deploy_vnet=false
location=''
is_branch_deployment=false
branch_name=''
branch_hash_id=''

function az_vnet_exists_func() {
    local rg=$1
    local vnetName=$2
    local count
    # vnetName's only current provenance is a Key Vault secret (not
    # attacker-controllable), so this isn't exploitable today, but escape
    # embedded single quotes before interpolating into the JMESPath string
    # literal anyway — cheap to harden now, before that provenance could ever
    # change, rather than have a quote silently mis-evaluate this filter later.
    local escapedVnetName=${vnetName//\'/\\\'}
    # Let a real Azure CLI failure (auth expiry, throttling, wrong subscription)
    # propagate and fail the script loudly, rather than silently reading as
    # "vnet missing" — a flaky call here would otherwise nondeterministically
    # affect the deployVnet decision below. This only works if the caller
    # captures the result as a plain statement rather than inline inside a
    # `[[ ]]` test (see call site below) — set -e ignores command failures
    # that occur as part of a test's condition.
    count=$(az network vnet list -g "${rg}" --query "length([?name=='${escapedVnetName}'])")
    if [[ -z ${count} || ${count} -eq 0 ]]; then
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

deployment_parameters="stackName=${stack_name} networkResourceGroupName=${network_rg} virtualNetworkName=${vnet_name} location=${location}"

# Deploy the vnet when explicitly requested, when it does not yet exist, or
# unconditionally for branches: branches deploy this as a Deployment Stack
# with --action-on-unmanage deleteResources. A resource that was
# stack-managed on a prior deploy but is absent from the CURRENT template's
# resources is treated as unmanaged and gets deleted. check-for-network.sh
# reports deployVnet=false once the vnet already exists — true for every
# deploy after a branch's first — so omitting the vnet module here on push #2+
# would delete the branch's own vnet out from under it (or fail with
# InUseSubnetCannotBeDeleted once app resources are attached — the exact class
# of failure this feature exists to prevent). The underlying vnet.bicep PUT is
# idempotent, so always including it for branches costs nothing. Main is
# unaffected — it's never stacked, so its existing existence-check behavior is
# preserved unchanged.
# Existence is only checked in the else branch (skipped whenever
# is_branch_deployment or deploy_vnet already decides the outcome — [[ ]]
# does short-circuit on those operands) and captured as its own statement
# rather than inline inside the `[[ ]]` test: a command substitution used
# directly as a test's condition has its exit status ignored by set -e, so a
# real `az network vnet list` CLI failure would otherwise silently read as
# "vnet missing" instead of aborting the script.
if [[ "${is_branch_deployment}" == "true" || "${deploy_vnet}" == true ]]; then
    deployment_parameters="${deployment_parameters} deployVnet=true"
else
    vnet_exists=$(az_vnet_exists_func "${network_rg}" "${vnet_name}")
    if [[ "${vnet_exists}" != true ]]; then
        deployment_parameters="${deployment_parameters} deployVnet=true"
    fi
fi

if [[ "${is_branch_deployment}" == "true" ]]; then
    # Derived via network_stack_name_for() (single source of truth, sourced
    # from _network-stackname.sh above) rather than reconstructed inline
    # here — also sourced by az-delete-branch-resources.sh's teardown, so
    # the two can't silently drift apart on this name.
    network_stack_name=$(network_stack_name_for "${stack_name}")
    echo "Deploying network resources as deployment stack ${network_stack_name} in ${network_rg}"
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az stack group create \
        --name "${network_stack_name}" \
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
    # az_deploy_func). `-w`/`--what-if` only previews changes and never
    # applies them, so both calls are required: dropping the second (non -w)
    # call would silently stop deploying main's network resources.
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -w -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
    # shellcheck disable=SC2086 # REASON: intentional word-splitting of --parameters
    az deployment group create -g "${network_rg}" --template-file "${deployment_file}" --parameter ${deployment_parameters}
fi
