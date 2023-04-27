#!/bin/bash

# Title:        azure-deploy.sh
# Description:  Helper script to deploy Azure resources for USTP CAMS
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

requiredParams=("appName" "networkResourceGroupName" "virtualNetworkName")

function validation_func() {
    app_rg=$1
    deployment_file=$2
    deployment_parameters=$3

    if [[ -z "${app_rg}" ]]; then
        echo "Error: Missing default resource group"
        exit 10
    fi

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
        appName=*) appName=${p/*=/} ;;
        networkResourceGroupName=*) networkResourceGroupName=${p/*=/} ;;
        virtualNetworkName=*) virtualNetworkName=${p/*=/} ;;
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

function az_vnet_exists_func() {
    count=$(az network vnet list -g $1 --query "length([?name=='$2'])" 2>/dev/null)
    if [[ $count -eq 0 ]]; then
        exists=false
    else
        exists=true
    fi
    echo $exists
}

function az_deploy_func() {
    echo "Deploying Azure resources via bicep template $2"
    if [[ $show_what_if ]]; then
        az deployment group create -w -g $1 --template-file $2 --parameter $3
    fi
    if [[ $? -eq 0 ]]; then
        az deployment group create -g $1 --template-file $2 --parameter $3 -o json --query properties.outputs | tee outputs.json
    fi

}

while [[ $# > 0 ]]; do
    case $1 in
    -h | --help)
        echo ""
        echo "USAGE: azure-deploy.sh -sw -g ustp-app-rg -f ../bicep/ustp-cams.bicep -p 'key01=value-01 key02=value-02 arrays=[\"test\resource\"] keyBool=true'"
        echo ""
        shift
        ;;

    -sw | --show-what-if)
        show_what_if=true
        shift
        ;;

    # default resource group name
    -g | --resourceGroup)
        app_rg="${2}"
        shift 2
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

validation_func $app_rg $deployment_file "$deployment_parameters"

# Check if existing vnet exists. Set createVnet to true. NOTE that this will be evaluated with deployVnet parameters.
if [ ! $(az_vnet_exists_func $networkResourceGroupName $virtualNetworkName) ]; then
    deployment_parameters="${deployment_parameters} createVnet=true"
fi

az_deploy_func $app_rg $deployment_file "${deployment_parameters}"
