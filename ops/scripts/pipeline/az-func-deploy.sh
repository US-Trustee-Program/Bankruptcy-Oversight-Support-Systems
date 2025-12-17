#!/usr/bin/env bash

# Title:        az-func-deploy.sh
# Description:  Helper script to deploy function build artifact to existing Azure site
# Usage:        ./az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors

set -euo pipefail # ensure job step fails in CI pipeline when error occurs
enable_debug=false
while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --settings=\"key1=value1 key2=value2\""
        exit 0
        ;;

    -d | --debug)
        enable_debug=true
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

function on_exit() {
    # Remove temporary IP access rules
    echo "Removing temporary IP access rules..."
    az functionapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --rule-name "deploy-runner-temp-1" --scm-site true 2>/dev/null || true
    az functionapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --rule-name "deploy-runner-temp-2" --scm-site true 2>/dev/null || true
}
trap on_exit EXIT

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact ${artifact_path}"
    exit 10
fi

# Add temporary IP access rules for SCM site (allow all IPs using two CIDR ranges)
echo "=========================================="
echo "Adding IP access rules to allow all addresses"
echo "Rule names: deploy-runner-temp-1, deploy-runner-temp-2"
echo "=========================================="

# Azure requires two CIDR ranges to cover all IPs: 0.0.0.0/1 and 128.0.0.0/1
az functionapp config access-restriction add \
    -g "${app_rg}" \
    -n "${app_name}" \
    --rule-name "deploy-runner-temp-1" \
    --action Allow \
    --ip-address "0.0.0.0/1" \
    --priority 100 \
    --scm-site true

az functionapp config access-restriction add \
    -g "${app_rg}" \
    -n "${app_name}" \
    --rule-name "deploy-runner-temp-2" \
    --action Allow \
    --ip-address "128.0.0.0/1" \
    --priority 101 \
    --scm-site true

echo "Waiting for access restriction propagation..."
sleep 10

# Construct and execute deployment command
cmd="az functionapp deployment source config-zip -g ${app_rg} -n ${app_name} --src ${artifact_path}"
if [[ ${enable_debug} == 'true' ]]; then
    cmd="${cmd} --debug"
fi
echo "Deployment started"
eval "${cmd}"
echo "Deployment completed"
