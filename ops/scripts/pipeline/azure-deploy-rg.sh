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

requiredParams=("databaseResourceGroupName" "networkResourceGroupName" "webappResourceGroupName" "analyticsResourceGroupName")

function validation_func() {
    local location=$1
    local deployment_file=$2
    local deployment_parameters=$3
    local isBranchDeployment=$4

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

    if [[ -z "${isBranchDeployment}" ]]; then
        echo "Error: Missing parameter (isBranchDeployment)"
        exit 14
    fi

    # Parse deployment_parameters and set required params as variables if it exists
    for p in $deployment_parameters; do
        case "${p}" in
        databaseResourceGroupName=*) databaseResourceGroupName=${p/*=/} ;;
        networkResourceGroupName=*) networkResourceGroupName=${p/*=/} ;;
        webappResourceGroupName=*) webappResourceGroupName=${p/*=/} ;;
        analyticsResourceGroupName=*) analyticsResourceGroupName=${p/*=/} ;;
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
}

function az_rg_exists_func() {
    # Explicitly checks its own command's exit status and exits loudly on
    # failure, rather than letting a genuine `az group exists` failure
    # (auth/network/throttling -- it does not fail for a legitimately-missing
    # RG) silently resolve to an empty string that gets misread as "RG
    # doesn't exist". This alone isn't sufficient, though: `exit` inside a
    # function invoked via command substitution only terminates that
    # subshell, not the calling script -- callers MUST capture the result as
    # its own statement (e.g. `x=$(az_rg_exists_func ...)`) rather than
    # inline inside an `if [ ... ]` test's condition, or set -e won't
    # propagate the failure either way (bash suspends errexit for
    # substitutions embedded directly in a test's condition). See the call
    # sites below.
    local rgExists
    local rc
    set +e
    rgExists=$(az group exists -n "$1")
    rc=$?
    set -e
    if [[ ${rc} -ne 0 ]]; then
        echo "ERROR: 'az group exists -n $1' failed (exit ${rc}) -- cannot determine whether the resource group exists." >&2
        exit "${rc}"
    fi
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
        printf "USAGE: azure-deploy-rg.sh -sw -l eastus -f ../cloud-deployment/ustp-cams.bicep -p 'key01=value-01 key02=value-02 arrays=[\"test\resource\"] keyBool=true' --isBranchDeployment true"
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

    --isBranchDeployment)
        isBranchDeployment="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

validation_func "${location}" "${deployment_file}" "${deployment_parameters}" "${isBranchDeployment:-}"

# include location to deployment parameters
deployment_parameters="${deployment_parameters} location=${location}"

needsCreate=false
# Each result is captured as its own statement, not inline inside the `[ ]`
# test below: a command substitution used directly as a test's condition has
# its exit status ignored by set -e (see az_rg_exists_func), so a real `az
# group exists` CLI failure would otherwise silently read as "RG missing"
# instead of aborting the script.
databaseRgExists=$(az_rg_exists_func "${databaseResourceGroupName}")
if [ "${databaseRgExists}" != true ]; then
deployment_parameters="${deployment_parameters} createDatabaseRG=true"
needsCreate=true
fi
networkRgExists=$(az_rg_exists_func "${networkResourceGroupName}")
if [ "${networkRgExists}" != true ]; then
deployment_parameters="${deployment_parameters} createNetworkRG=true"
needsCreate=true
fi
webappRgExists=$(az_rg_exists_func "${webappResourceGroupName}")
if [ "${webappRgExists}" != true ]; then
deployment_parameters="${deployment_parameters} createAppRG=true"
needsCreate=true
fi
# Only create analytics resource group for non-branch deployments (main branch)
if [ "${isBranchDeployment}" != "true" ]; then
analyticsRgExists=$(az_rg_exists_func "${analyticsResourceGroupName}")
if [ "${analyticsRgExists}" != true ]; then
deployment_parameters="${deployment_parameters} createAnalyticsRG=true"
needsCreate=true
fi
fi

# Skip the deployment call entirely when every resource group already exists.
# This isn't just an optimization: az deployment sub create is a subscription-scope
# operation regardless of whether the underlying bicep template creates anything
# (the create<X>RG params above only gate bicep-internal conditionals, not the API
# call itself). For branch deployments, the database/network/webapp RGs it
# actually checks are always pre-existing, shared, stable resource groups
# every branch uses (rg-cams-app-dev/rg-cams-network-dev, CAMS-760) --
# analytics is a main-only resource and its existence is never checked for
# branch (see the isBranchDeployment guard below), not verified-and-found-
# present. This call would otherwise be a guaranteed no-op requiring
# subscription-scope write on every single branch deploy, forever, which is
# exactly the permission branch's RG-scoped Contributor grant (Slice 3) does
# not have.
if [ "${needsCreate}" = true ]; then
az_deploy_func "${location}" "${deployment_file}" "${deployment_parameters}"
else
echo "All resource groups already exist; skipping subscription-scope RG deployment."
fi
