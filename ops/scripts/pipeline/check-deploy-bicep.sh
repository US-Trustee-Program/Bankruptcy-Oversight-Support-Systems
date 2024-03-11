#!/usr/bin/env bash

# Title:        check-deploy-bicep.sh
# Description:  Helper script to check if bicep changes have been made and if bicep should be deployed
#

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

app_rg=$1
deploy_flag=$2 #workflow dispatch parameter enableBicepDeployment from GHA

deployBicep=false #default bicep deployment to false

#If rg show fails, we want to continue instead of erroring out
rg_response=$(az group show --name "${app_rg}" --query "[name]" -o tsv  || true)

#diff of previous merge commit  and current head only on folders containing potential infrastructure changes
changes=$(git diff HEAD^@ HEAD -- ./ops/cloud-deployment/ ./.github/workflows/continuous-deployment.yml)

if [[ $changes != "" || $rg_response == "" || $deploy_flag == true  ]]; then
    deployBicep=true
fi

echo $deployBicep
