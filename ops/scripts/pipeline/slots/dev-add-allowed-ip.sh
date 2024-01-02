#!/usr/bin/env bash

# Description: Helper script to add IP allow rule for user
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: dev-add-allowed-ip.sh <resource_group_name:str> <stack_name:str> <priority:int> <isCICD:bool>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

ci=
ip=
slot_name=
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        printf ""
        printf "Usage: dev-add-allowed-ip.sh -g <resource_group_name:str> -s <stack_name:str> -p <priority:int> --is-cicd <isCICD:bool> -ip <IP_Address>"
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
    -p | --priority)
        priority="${2}"
        shift 2
        ;;
    --is-cicd)
        ci=true
        shift
        ;;
    -ip | --ip-address)
        ip="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [[ -z "${app_rg}" || -z "${stack_name}" || -z "${priority}" ]]; then
    printf "Error: Missing parameters. Usage: dev-add-allowed-ip.sh <resource_group_name:str> <stack_name:str> <priority:int>"
    exit 1
fi

if [[ -z "${ip}" ]]; then
    agentIp=$(curl -s --retry 3 --retry-delay 30 --retry-connrefused https://api.ipify.org)
else
    agentIp=${ip}
fi

if [[ -z "${ci}" ]]; then
    ruleName="dev-agent-${agentIp}"
else
    ruleName="gha-${priority}-${stack_name}"
fi

ruleName=${ruleName:0:32} # trim up to 32 character limit
echo "Attempting to add Ip allow rule (${ruleName})"
if [[ ${slot_name} == 'staging' ]]; then
    echo "Adding IP to staging deployment slot..."
    az functionapp config access-restriction add -g "${app_rg}" -n "${stack_name}-node-api" --rule-name "${ruleName}" --slot "${slot_name}" --action Allow --ip-address "${agentIp}" --priority "${priority}1" 1>/dev/null
    az webapp config access-restriction add -g "${app_rg}" -n "${stack_name}-webapp" --rule-name "${ruleName}" --slot "${slot_name}" --action Allow --ip-address "$agentIp" --priority "${priority}2" 1>/dev/null
else
    echo "Adding IP to main deployment slot..."
    az functionapp config access-restriction add -g "${app_rg}" -n "${stack_name}-node-api" --rule-name "${ruleName}" --action Allow --ip-address "${agentIp}" --priority "${priority}1" 1>/dev/null
    az webapp config access-restriction add -g "${app_rg}" -n "${stack_name}-webapp" --rule-name "${ruleName}" --action Allow --ip-address "$agentIp" --priority "${priority}2" 1>/dev/null
fi
echo "Done"
