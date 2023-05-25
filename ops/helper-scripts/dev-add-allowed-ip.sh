#!/usr/bin/env bash

# Description: Helper script to add IP allow rule for user
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: dev-add-allowed-ip.sh <resource_group_name:str> <stack_name:str> <priority:int> <isCICD:bool>

set -euo pipefail

app_rg=$1
stack_name=$2
priority=$3
if (($# == 4)); then
    ci=$4
else
    ci=
fi

if [[ -z "${app_rg}" || -z "${stack_name}" || -z "${priority}" ]]; then
    echo "Error: Missing parameters. Usage: dev-add-allowed-ip.sh <resource_group_name:str> <stack_name:str> <priority:int>"
    exit 1
fi

agentIp=$(curl -s https://api.ipify.org)

if [[ $ci ]]; then
    ruleName="gha-agent-${stack_name:0:16}"
else
    ruleName="dev-agent-${agentIp:0:16}"
fi
echo "Attempting to add Ip allow rule (${ruleName})"
az functionapp config access-restriction add -g $app_rg -n "${stack_name}-node-api" --rule-name $ruleName --action Allow --ip-address $agentIp --priority "${priority}1" 1>/dev/null

az functionapp config access-restriction add -g $app_rg -n "${stack_name}-webapp" --rule-name $ruleName --action Allow --ip-address $agentIp --priority "${priority}2" 1>/dev/null

echo "Done"
