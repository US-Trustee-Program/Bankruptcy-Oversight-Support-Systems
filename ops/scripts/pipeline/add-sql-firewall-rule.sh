#!/usr/bin/env bash

# Description: Helper script to add IP SQL firewall to SQL rule for GHA runner
# Prerequisite:
#   - curl
#   - Azure CLI
# "Usage: add-sql-firewall-rule.sh -g <resource_group_name:str> -stack-name <stack_name:str> --server-name <sqlServerName:str>"


set -euo pipefail # ensure job step fails in CI pipeline when error occurs

delete=
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        printf ""
        printf "Usage: add-sql-firewall-rule.sh -g <resource_group_name:str> -stack-name <stack_name:str> --server-name <sqlServerName:str>"
        printf ""
        shift
        ;;
    -g | --resource-group)
        db_rg="${2}"
        shift 2
        ;;

    --server-name)
        sql_server_name="${2}"
        shift 2
        ;;

    --stack-name)
        stack_name="${2}"
        shift 2
        ;;

    --delete)
        delete=true
        shift
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [[ -z "${db_rg}" || -z "${stack_name}" || -z "${sql_server_name}" ]]; then
    printf "Error: Missing parameters. Usage: dev-add-allowed-ip.sh <resource_group_name:str> <stack_name:str> <priority:int>"
    exit 1
fi


agentIp=$(curl -s --retry 3 --retry-delay 30 --retry-all-errors https://api.ipify.org)

ruleName="gha-${stack_name}"

ruleName=${ruleName:0:32} # trim up to 32 character limit

if [[ -n "${delete}" ]]; then
    echo "Attempting to delete firewall IP allow rule (${ruleName}) on sql server..."
    az sql server firewall-rule delete --resource-group "${db_rg}" --name "${ruleName}" --server "${sql_server_name}"
    echo "Rule deleted..."
else
    echo "Attempting to create firewall IP allow rule (${ruleName}) on sql server..."
    az sql server firewall-rule create --resource-group "${db_rg}" --name "${ruleName}" --server "${sql_server_name}" --start-ip-address "${agentIp}" --end-ip-address "${agentIp}"
    echo "Rule created..."
fi
