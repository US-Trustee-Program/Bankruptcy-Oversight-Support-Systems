#!/usr/bin/env bash

# Title:        check-git-diff.sh
# Description:  Helper script to check if bicep changes have been made and if bicep should be deployed
#
# Exitcodes
# ==========
# 1   missing parameter

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

app_rg=$1
deployBicep=false

rg_response=$(az group show --name "${app_rg}" --query "[name]" -o tsv  || true)  #continue if rg show fails

#compares current commit with previous commit for changes in bicep directory
changes=$(git diff HEAD^ HEAD -- ./ops/cloud-deployment/)



if [[ $changes != "" && $rg_response != "" ]] || [[ $rg_response == "" ]]; then
    deployBicep=true
else
    deployBicep=false
fi

echo $deployBicep
