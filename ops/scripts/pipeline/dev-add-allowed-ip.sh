#!/usr/bin/env bash

# Description: Helper script to add IP allow rule for user
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: dev-add-allowed-ip.sh <resource_group_name:str> <stack_name:str> <priority:int> <isCICD:bool> <slot_name:str>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

ci=
slot_name=
is_ustp_deployment=false
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        printf ""
        printf "Usage: dev-add-allowed-ip.sh -g <resource_group_name:str> -s <stack_name:str> -p <priority:int> --is-cicd <isCICD:bool> -ip <IP_Address> --slot-name slotName [--isUstpDeployment]"
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
    --isUstpDeployment)
        is_ustp_deployment=true
        shift
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [[ -z "${app_rg}" || -z "${stack_name}" ]]; then
    printf "Error: Missing parameters. Usage: dev-add-allowed-ip.sh <resource_group_name:str> <stack_name:str>"
    exit 1
fi

if [ "${is_ustp_deployment}" = true ]; then
    # USTP environment: Set main site default actions to Allow instead of adding IP rules
    echo "=========================================="
    echo "USTP Deployment: Setting main site default actions to Allow"
    echo "=========================================="

    if [[ -n ${slot_name} && ${slot_name} != "initial" && ${slot_name} != "self" ]]; then
        echo "Setting main site default actions for ${slot_name} deployment slot..."
        az functionapp config access-restriction set -g "${app_rg}" -n "${stack_name}-node-api" --slot "${slot_name}" --default-action Allow
        az functionapp config access-restriction set -g "${app_rg}" -n "${stack_name}-dataflows" --slot "${slot_name}" --default-action Allow
        az webapp config access-restriction set -g "${app_rg}" -n "${stack_name}-webapp" --slot "${slot_name}" --default-action Allow
    else
        echo "Setting main site default actions for main deployment slot..."
        az functionapp config access-restriction set -g "${app_rg}" -n "${stack_name}-node-api" --default-action Allow
        az webapp config access-restriction set -g "${app_rg}" -n "${stack_name}-webapp" --default-action Allow
    fi

    echo "Waiting for access restriction propagation..."
    sleep 10
else
    # Flexion environment: Add specific IP rules (current behavior)
    if [[ -z "${priority}" ]]; then
        printf "Error: Missing priority parameter for Flexion deployment"
        exit 1
    fi

    agent_ip=$(curl -s --retry 3 --retry-delay 30 --retry-all-errors https://api.ipify.org)

    if [[ -z "${ci}" ]]; then
        rule_name="dev-agent-${agent_ip}"
    else
        rule_name="gha-${priority}-${stack_name}"
    fi

    rule_name=${rule_name:0:32} # trim up to 32 character limit
    echo "Attempting to add Ip allow rule (${rule_name})"
    if [[ -n ${slot_name} && ${slot_name} != "initial" && ${slot_name} != "self" ]]; then
        echo "Adding IP to ${slot_name} deployment slot..."
        az functionapp config access-restriction add -g "${app_rg}" -n "${stack_name}-node-api" --rule-name "${rule_name}" --slot "${slot_name}" --action Allow --ip-address "${agent_ip}" --priority "${priority}1" 1>/dev/null
        az functionapp config access-restriction add -g "${app_rg}" -n "${stack_name}-dataflows" --rule-name "${rule_name}" --slot "${slot_name}" --action Allow --ip-address "${agent_ip}" --priority "${priority}1" 1>/dev/null
        az webapp config access-restriction add -g "${app_rg}" -n "${stack_name}-webapp" --rule-name "${rule_name}" --slot "${slot_name}" --action Allow --ip-address "$agent_ip" --priority "${priority}2" 1>/dev/null
    else
        echo "Adding IP to main deployment slot..."
        az functionapp config access-restriction add -g "${app_rg}" -n "${stack_name}-node-api" --rule-name "${rule_name}" --action Allow --ip-address "${agent_ip}" --priority "${priority}1" 1>/dev/null
        az webapp config access-restriction add -g "${app_rg}" -n "${stack_name}-webapp" --rule-name "${rule_name}" --action Allow --ip-address "$agent_ip" --priority "${priority}2" 1>/dev/null
    fi
fi
echo "Done"
