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

scm_default_action_changed=false

function on_exit() {
    # Restore SCM default action to Deny if it was changed
    if [ "${scm_default_action_changed}" = true ]; then
        echo "Restoring SCM default action to Deny..."
        az functionapp config access-restriction set \
            -g "${app_rg}" \
            -n "${app_name}" \
            --scm-default-action Deny 2>/dev/null || echo "Warning: Failed to restore SCM default action"
    fi
}
trap on_exit EXIT

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact ${artifact_path}"
    exit 10
fi

# Temporarily set SCM default action to Allow for deployment
echo "=========================================="
echo "Setting SCM default action to Allow for deployment"
echo "=========================================="
az functionapp config access-restriction set \
    -g "${app_rg}" \
    -n "${app_name}" \
    --scm-default-action Allow

scm_default_action_changed=true

echo ""
echo "Verifying SCM access restriction..."
az functionapp config access-restriction show \
    -g "${app_rg}" \
    -n "${app_name}" \
    --query "{ScmDefaultAction: scmIpSecurityRestrictionsDefaultAction}" \
    -o table

echo ""
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
