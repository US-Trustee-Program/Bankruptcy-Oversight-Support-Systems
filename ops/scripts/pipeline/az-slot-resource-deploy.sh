#!/bin/bash

# Title:        az-app-deploy.sh
# Description:  Helper script to deploy webapp build artifact to existing Azure site
# Usage:        ./az-app-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n webappName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-slot-deploy.sh -h -g resourceGroupName --webappName webappName --apiName functionappName --slot staging"
        shift
        ;;
    -g | --resourceGroup)
        app_rg="${2}"
        shift 2
        ;;

    --apiName)
        api_name="${2}"
        shift 2
        ;;

    --webappName)
        webapp_name="${2}"
        shift 2
        ;;

    --slotName)
        slot_name="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done


# az webapp config show --name $webapp_name --resource-group $app_rg --query name -o tsv
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az webapp deployment slot create --name $webapp_name --resource-group $app_rg --slot $slot_name --configuration-source $webapp_name
# shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
az functionapp deployment slot create --name $api_name --resource-group $app_rg --slot $slot_name --configuration-source $api_name
