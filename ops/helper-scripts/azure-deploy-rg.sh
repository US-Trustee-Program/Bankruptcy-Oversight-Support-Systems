#!/bin/bash

# Title:        azure-deploy-rg.sh
# Description:  Helper script to create Azure Resource Groups for USTP-CAMS deployment.
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

requiredParams=("databaseResourceGroupName" "networkResourceGroupName" "webappResourceGroupName")

function validation_func() {
    deployment_file=$1
    deployment_parameters=$2

    if [[ -z "${deployment_file}" ]]; then
        echo "Error: Missing deployment file"
        exit 11
    fi

    if [ ! -f ${deployment_file} ]; then
        echo "Error: File (${deployment_file}) does not exist."
        exit 12
    fi

    if [[ -z "${deployment_parameters}" ]]; then
        echo "Error: Missing deployment parameters"
        exit 13
    fi

    # Parse deployment_parameters and set required params as variables
    for p in $deployment_parameters; do
        case "$p" in
        databaseResourceGroupName=*) databaseResourceGroupName=${p/*=/} ;;
        networkResourceGroupName=*) networkResourceGroupName=${p/*=/} ;;
        webappResourceGroupName=*) webappResourceGroupName=${p/*=/} ;;
        *)
            # skipped unmatched keys
            ;;
        esac
    done

    # Check that required params has been set
    for r in ${requiredParams[@]}; do
        varOfVar=$r
        if [[ -z ${!varOfVar} ]]; then
            echo "Error: Missing parameter ($r)"
            exit 14
        fi
    done
}

while [[ $# > 0 ]]; do
    case $1 in
    -h | --help)
        echo ""
        echo "USAGE: azure-deploy-rg.sh -sw -f ../cloud-deployment/ustp-cams.bicep -p 'key01=value-01 key02=value-02 arrays=[\"test\resource\"] keyBool=true'"
        echo ""
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

function az_rg_exists_func() {
    echo $(az group exists -n $1)
}

validation_func $deployment_file "$deployment_parameters"

# Check if existing vnet exists. Set createVnet to true. NOTE that this will be evaluated with deployVnet parameters.
if [ "$(az_rg_exists_func $databaseResourceGroupName)" != true ]; then
    deployment_parameters="${deployment_parameters} createDatabaseRG=true"
fi
if [ "$(az_rg_exists_func $networkResourceGroupName)" != true ]; then
    deployment_parameters="${deployment_parameters} createNetworkRG=true"
fi
if [ "$(az_rg_exists_func $webappResourceGroupName)" != true ]; then
    deployment_parameters="${deployment_parameters} createWebappRG=true"
fi
