#!/usr/bin/env bash

# Title:        azure-deploy-rg.sh
# Description:  Helper script to create Azure resource group(s) for USTP CAMS deployment if it does not exist.
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

requiredParams=("databaseResourceGroupName" "networkResourceGroupName" "webappResourceGroupName" "isBranch")
requiredBranchDeployParams=("branchName" "branchHashId") # To setup the appropiate Azure resource tagging, these should be required when isBranch == true

function validation_func() {
    local location=$1
    local deployment_file=$2
    local deployment_parameters=$3

    if [[ -z "${location}" ]]; then
        echo "Error: Missing location parameter"
        exit 10
    fi

    if [[ -z "${deployment_file}" ]]; then
        echo "Error: Missing deployment file"
        exit 11
    fi

    if [ ! -f "${deployment_file}" ]; then
        echo "Error: File (${deployment_file}) does not exist."
        exit 12
    fi

    if [[ -z "${deployment_parameters}" ]]; then
        echo "Error: Missing deployment parameters"
        exit 13
    fi

    # Parse deployment_parameters and set required params as variables
    for p in $deployment_parameters; do
        case "${p}" in
        databaseResourceGroupName=*) databaseResourceGroupName=${p/*=/} ;;
        networkResourceGroupName=*) networkResourceGroupName=${p/*=/} ;;
        webappResourceGroupName=*) webappResourceGroupName=${p/*=/} ;;
        isBranch=*) isBranch=${p/*=/} ;;
        *)
            # skipped unmatched keys
            ;;
        esac
    done

    # Check that required params has been set
    for r in "${requiredParams[@]}"; do
        varOfVar=${r}
        if [[ -z ${!varOfVar} ]]; then
            echo "Error: Missing parameter (${r})"
            exit 14
        fi
    done
    # Check that required params for branch deployments has been set
    if [[ "${isBranch}" == "true" ]]; then
        for r in "${requiredBranchDeployParams[@]}"; do
            varOfVar=${r}
            if [[ -z ${!varOfVar} ]]; then
                echo "Error: Missing parameter required for branch deployments (${r})"
                exit 15
            fi
        done
    fi
}

function az_rg_exists_func() {
    rgExists=$(az group exists -n "$1")
    echo "${rgExists}"
}

function az_deploy_func() {
    local location=$1
    local templateFile=$2
    local deploymentParameter=$3
    echo "Deploying Azure Resource Groups via bicep template ${templateFile}"
    if [[ $show_what_if ]]; then
        # shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --parameter
        az deployment sub create -w -l "${location}" --template-file "${templateFile}" --parameter ${deploymentParameter}
    fi
    # shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --parameter
    az deployment sub create -l "${location}" --template-file "${templateFile}" --parameter ${deploymentParameter}
}

show_what_if=false
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        printf ""
        printf "USAGE: azure-deploy-rg.sh -sw -l eastus -f ../cloud-deployment/ustp-cams.bicep -p 'key01=value-01 key02=value-02 arrays=[\"test\resource\"] keyBool=true'"
        printf ""
        shift
        ;;

    -sw | --show-what-if)
        show_what_if=true
        shift
        ;;

    # path to main bicep
    -f | --file)
        deployment_file="${2}"
        shift 2
        ;;

    -l | --location)
        location="${2}"
        shift 2
        ;;

    # collection of key=value delimited by space e.g. 'appName=ustp-dev-01 deployVnet=false deployNetwork=true linkVnetIds=[]'
    -p | --parameters)
        deployment_parameters="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

validation_func "${location}" "${deployment_file}" "${deployment_parameters}"

# include location to deployment parameters
deployment_parameters="${deployment_parameters} location=${location}"

if [ "$(az_rg_exists_func "${databaseResourceGroupName}")" != true ]; then
    deployment_parameters="${deployment_parameters} createDatabaseRG=true"
fi
if [ "$(az_rg_exists_func "${networkResourceGroupName}")" != true ]; then
    deployment_parameters="${deployment_parameters} createNetworkRG=true"
fi
if [ "$(az_rg_exists_func "${webappResourceGroupName}")" != true ]; then
    deployment_parameters="${deployment_parameters} createAppRG=true"
fi

az_deploy_func "${location}" "${deployment_file}" "${deployment_parameters}"
