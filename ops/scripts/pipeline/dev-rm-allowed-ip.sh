#!/usr/bin/env bash

# Description: Helper script to remove existing IP allow rule by name
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: dev-rm-allowed-ip.sh -g <resource_group_name:str> -s <stack_name:str> -r <rule_name:str> --slot-name <slot_name:str>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

slot_name=
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        printf ""
        printf "Usage: dev-add-allowed-ip.sh -g <resource_group_name:str> -s <stack_name:str> -p <priority:int> --is-cicd <isCICD:bool> -ip <IP_Address> --slot-name slotName"
        printf ""
        shift
        ;;
    -g | --resource-group)
        app_rg="${2}"
        shift 2
        ;;
    -s | --stack-name)
        stack_name="${2}"
        shift 2
        ;;

    --slot-name)
        slot_name="${2}"
        shift 2
        ;;
    -r | --rule-name)
        rule_name="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done


if [[ -z "${app_rg}" || -z "${stack_name}" || -z "${rule_name}" ]]; then
    echo "Error: Missing parameters. Usage: dev-rm-allowed-ip.sh <resource_group_name:str> <stack_name:str> <rule_name:str>"
    exit 1
fi

echo "Removing Ip allow rule by name (${rule_name})"
if [[ ${slot_name} == 'staging' ]]; then
    echo "Removing GHA IP from staging deployment slot..."
    az functionapp config access-restriction remove -g "${app_rg}" -n "${stack_name}"-node-api --slot "${slot_name}" --rule-name "${rule_name}" 1>/dev/null
    az functionapp config access-restriction remove -g "${app_rg}" -n "${stack_name}"-webapp --slot "${slot_name}" --rule-name "${rule_name}" 1>/dev/null
else
    echo "Removing GHA IP from production deployment slot..."
    az functionapp config access-restriction remove -g "${app_rg}" -n "${stack_name}-node-api" --rule-name "${rule_name}" 1>/dev/null
    az functionapp config access-restriction remove -g "${app_rg}" -n "${stack_name}-webapp" --rule-name "${rule_name}" 1>/dev/null
fi

echo "Done"
