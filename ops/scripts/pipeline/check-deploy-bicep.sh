#!/usr/bin/env bash

# Title:        check-deploy-bicep.sh
# Description:  Helper script to check if bicep changes have been made and if bicep should be deployed

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

app_rg=$1
deploy_flag=$2 #workflow dispatch parameter enableBicepDeployment from GHA

deployBicep=false #default bicep deployment to false

#If rg show fails, we want to continue instead of erroring out
rg_response=$(az group show --name "${app_rg}" --query "[name]" -o tsv  || true)

#uses branch to get previous merge commits hash
branch=$(git branch --show-current)
# shellcheck disable=SC2086 # REASON: Quotes renders the branch unusable
lastMergeCommitSha=$(git log ${branch} --first-parent --pretty=format:"%H" --merges -n 1)
if [[ $lastMergeCommitSha != "" && $branch == "main" ]] ; then
    # shellcheck disable=SC2086 # REASON: Qoutes render the commit sha unusable
    changes=$(git diff ${lastMergeCommitSha} HEAD -- ./ops/cloud-deployment/ ./.github/workflows/)
else
    changes=$(git diff HEAD origin/main -- ./ops/cloud-deployment/ ./.github/workflows/)
fi

if [[ $changes != "" || $rg_response == "" || $deploy_flag == true || $deploy_flag == "true" ]]; then #
    deployBicep=true
fi

echo $deployBicep
