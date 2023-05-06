#!/usr/bin/env bash

# Description: Helper script to add IP allow rule for user
# Prerequisite:
#   - curl
#   - Azure CLI
# Usage: dev-add-allowed-ip.sh <resource_group_name:str> <stack_name:str> <priority:int>

set -e

app_rg=$1
stack_name=$2
priority=$3

agentIp=$(curl -s https://api.ipify.org)
ruleName="dev-agent-${agentIp:0:16}"
az functionapp config access-restriction add -g $app_rg -n "${stack_name}-node-api" --rule-name $ruleName --action Allow --ip-address $agentIp --priority "${priority}1" 1> /dev/null
az functionapp config access-restriction add -g $app_rg -n "${stack_name}-webapp" --rule-name $ruleName --action Allow --ip-address $agentIp --priority "${priority}2" 1> /dev/null

echo "Done"
