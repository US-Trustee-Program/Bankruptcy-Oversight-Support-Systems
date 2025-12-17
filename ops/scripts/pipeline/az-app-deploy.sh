#!/usr/bin/env bash

# Title:        az-app-deploy.sh
# Description:  Helper script to deploy webapp build artifact to existing Azure site
# Usage:        ./az-app-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n webappName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName"
        shift
        ;;
    -g | --resourceGroup)
        app_rg="${2}"
        shift 2
        ;;

    -n | --name)
        app_name="${2}"
        shift 2
        ;;

    -s | --src)
        artifact_path="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

if [ ! -f "${artifact_path}" ]; then
    echo "Error: missing build artifact ${artifact_path}"
    exit 10
fi

function on_exit() {
    # Remove temporary IP access rules
    echo "Removing temporary IP access rules..."
    az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --rule-name "deploy-runner-temp-1" --scm-site true 2>/dev/null || true
    az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --rule-name "deploy-runner-temp-2" --scm-site true 2>/dev/null || true
}
trap on_exit EXIT

# Add temporary IP access rules for SCM site (allow all IPs using two CIDR ranges)
echo "=========================================="
echo "Adding IP access rules to allow all addresses"
echo "Rule names: deploy-runner-temp-1, deploy-runner-temp-2"
echo "=========================================="

# Azure requires two CIDR ranges to cover all IPs: 0.0.0.0/1 and 128.0.0.0/1
az webapp config access-restriction add \
    -g "${app_rg}" \
    -n "${app_name}" \
    --rule-name "deploy-runner-temp-1" \
    --action Allow \
    --ip-address "0.0.0.0/1" \
    --priority 100 \
    --scm-site true

az webapp config access-restriction add \
    -g "${app_rg}" \
    -n "${app_name}" \
    --rule-name "deploy-runner-temp-2" \
    --action Allow \
    --ip-address "128.0.0.0/1" \
    --priority 101 \
    --scm-site true

echo "Waiting for access restriction propagation..."
sleep 10
az webapp deploy --resource-group "${app_rg}" --src-path "${artifact_path}" --name "${app_name}" --type zip --async true --track-status false
