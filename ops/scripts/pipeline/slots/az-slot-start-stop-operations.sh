#!/usr/bin/env bash

# Description: Helper script to start and stop slots so we do not run sync function-apps against slot resources
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: az-slot-lifecycle.sh -g <resource_group_name:str> --apiName <apiName:str> --webappName <webapp_name:str> --slotName <slot_name:str> --operation <start|stop>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

slot_name='staging'
operation='start'

while [[ $# -gt 0 ]]; do
    case $1 in
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

    --operation)
        operation="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [[ ${operation} == 'stop' ]]; then
    echo "Stopping Node API ${slot_name} slot..."
    az functionapp stop -g "${app_rg}" --name "${api_name}" --slot "${slot_name}"
    echo "Stopping Webapp ${slot_name} slot..."
    az webapp stop -g "${app_rg}" --name "${webapp_name}" --slot "${slot_name}"

elif [[ ${operation} == 'start' ]]; then
    echo "Starting Node API ${slot_name} slot..."
    az functionapp start -g "${app_rg}" --name "${api_name}" --slot "${slot_name}"
    echo "Starting Webapp ${slot_name} slot..."
    az webapp start -g "${app_rg}" --name "${webapp_name}" --slot "${slot_name}"

else
    echo "Invalid Operation ${operation}"
    exit 2;

fi
