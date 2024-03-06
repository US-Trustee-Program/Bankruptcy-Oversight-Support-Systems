#!/usr/bin/env bash

# Title:        check-git-diff.sh
# Description:  Helper script to check if bicep changes have been made
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

app_rg=$1

if [[ -z "${app_rg}" ]]; then
    echo "Error: Missing parameters. Usage: check-branch-exists.sh <app_rg:str>"
    exit 1
fi
rg_response=$(az group show --name "${app_rg}" --query "[name]" -o tsv) || true #continue if rg show fails

changes=$(git diff HEAD^ HEAD -- ./ops/cloud-deployment/)



if [[ $changes != "" && $rg_response != "" ]] || [[ $rg_response == "" ]]; then
    deployBicep=true
else
    deployBicep=false
fi

echo $deployBicep
