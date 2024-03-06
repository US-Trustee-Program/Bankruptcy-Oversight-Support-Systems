#!/usr/bin/env bash

# Title:        check-deploy-bicep.sh
# Description:  Helper script to check if bicep changes have been made and if bicep should be deployed
#
# Exitcodes
# ==========
# 1   missing parameter

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

app_rg=$1
deployBicep=false
containsBicep=false

rg_response=$(az group show --name "${app_rg}" --query "[name]" -o tsv  || true)  #continue if rg show fails

changes=$(git diff HEAD^ HEAD)
if [[ $changes == *".bicep"* ]]; then #checks if most recent commit contains changes in any .bicep
    containsBicep=true
else
    containsBicep=false
fi



if [[ $containsBicep == true || $rg_response == "" ]]; then
    deployBicep=true
else
    deployBicep=false
fi

echo $deployBicep
