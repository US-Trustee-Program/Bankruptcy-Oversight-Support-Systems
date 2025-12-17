#!/usr/bin/env bash

# Description: Helper script to remove existing IP allow rule by name
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: dev-rm-allowed-ip.sh -g <resource_group_name:str> -s <stack_name:str> -r <rule_name:str> --slot-name <slot_name:str>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

slot_name=
is_ustp_deployment=false
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        printf ""
        printf "Usage: dev-rm-allowed-ip.sh -g <resource_group_name:str> -s <stack_name:str> -r <rule_name:str> --slot-name <slot_name:str> [--isUstpDeployment]"
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
    echo "Error: Missing parameters. Usage: dev-rm-allowed-ip.sh <resource_group_name:str> <stack_name:str>"
    exit 1
fi

if [ "${is_ustp_deployment}" = true ]; then
    # USTP environment: Restore main site default actions to Deny
    echo "=========================================="
    echo "USTP Deployment: Restoring main site default actions to Deny"
    echo "=========================================="

    if [[ -n ${slot_name} && ${slot_name} != "initial" && ${slot_name} != "self" ]]; then
        echo "Restoring main site default actions for ${slot_name} deployment slot..."
        az functionapp config access-restriction set -g "${app_rg}" -n "${stack_name}-node-api" --slot "${slot_name}" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore node-api default action"
        az functionapp config access-restriction set -g "${app_rg}" -n "${stack_name}-dataflows" --slot "${slot_name}" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore dataflows default action"
        az webapp config access-restriction set -g "${app_rg}" -n "${stack_name}-webapp" --slot "${slot_name}" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore webapp default action"
    else
        echo "Restoring main site default actions for main deployment slot..."
        az functionapp config access-restriction set -g "${app_rg}" -n "${stack_name}-node-api" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore node-api default action"
        az webapp config access-restriction set -g "${app_rg}" -n "${stack_name}-webapp" --default-action Deny 2>/dev/null || echo "Warning: Failed to restore webapp default action"
    fi
else
    # Flexion environment: Remove specific IP rules (current behavior)
    if [[ -z "${rule_name}" ]]; then
        echo "Error: Missing rule_name parameter for Flexion deployment"
        exit 1
    fi

    echo "Removing Ip allow rule by name (${rule_name})"
    if [[ -n ${slot_name} && ${slot_name} != "initial" && ${slot_name} != "self" ]]; then
        echo "Removing GHA IP from ${slot_name} deployment slot..."
        az functionapp config access-restriction remove -g "${app_rg}" -n "${stack_name}"-node-api --slot "${slot_name}" --rule-name "${rule_name}" 1>/dev/null
        az functionapp config access-restriction remove -g "${app_rg}" -n "${stack_name}"-dataflows --slot "${slot_name}" --rule-name "${rule_name}" 1>/dev/null
        az webapp config access-restriction remove -g "${app_rg}" -n "${stack_name}"-webapp --slot "${slot_name}" --rule-name "${rule_name}" 1>/dev/null
    else
        echo "Removing GHA IP from production deployment slot..."
        az functionapp config access-restriction remove -g "${app_rg}" -n "${stack_name}-node-api" --rule-name "${rule_name}" 1>/dev/null
        az webapp config access-restriction remove -g "${app_rg}" -n "${stack_name}-webapp" --rule-name "${rule_name}" 1>/dev/null
    fi
fi

echo "Done"
