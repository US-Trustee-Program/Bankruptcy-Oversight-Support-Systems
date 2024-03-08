#!/usr/bin/env bash

# Title:        check-deploy-bicep.sh
# Description:  Helper script to check if bicep changes have been made and if bicep should be deployed
#

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

app_rg=$1
deploy_flag=$2 #workflow dispatch parameter enableBicepDeployment from GHA

deployBicep=false #default bicep deployment to false
containsBicep=false

rg_response=$(az group show --name "${app_rg}" --query "[name]" -o tsv  || true)  #continue if rg show fails

changes=$(git diff HEAD origin/main)
if [[ $changes == *".bicep"* && $changes == *"cloud-deployment"* ]] || [[ $changes == *"continuous-deployment.yml"* ]]; then
 #checks if most recent commit contains changes in any .bicep or in the workflow file. Changes in the workflow file have the potential to affect bicep resources withiout modifying the bicep directly
    containsBicep=true
else
    containsBicep=false
fi



if [[ $containsBicep == true || $rg_response == "" || $deploy_flag == "true" ]]; then
    deployBicep=true
fi

echo $deployBicep
