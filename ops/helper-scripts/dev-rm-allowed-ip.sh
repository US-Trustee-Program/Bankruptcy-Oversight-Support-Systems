#!/usr/bin/env bash

# Description: Helper script to remove existing IP allow rule by name
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: dev-rm-allowed-ip.sh <resource_group_name:str> <stack_name:str> <rule_name:str>

set -euo pipefail

app_rg=$1
stack_name=$2
rule_name=$3

if [[ -z "${app_rg}" || -z "${stack_name}" || -z "${rule_name}" ]]; then
    echo "Error: Missing parameters. Usage: dev-rm-allowed-ip.sh <resource_group_name:str> <stack_name:str> <rule_name:str>"
    exit 1
fi

echo "Removing Ip allow rule by name (${rule_name})"

az functionapp config access-restriction remove -g $app_rg -n "${stack_name}-node-api" --rule-name $rule_name 1>/dev/null

az functionapp config access-restriction remove -g $app_rg -n "${stack_name}-webapp" --rule-name $rule_name 1>/dev/null

echo "Done"
