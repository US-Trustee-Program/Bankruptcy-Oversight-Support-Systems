#!/bin/bash

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
deploy_slot=false
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-func-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName"
        shift
        ;;
    --deploySlot)
        deploy_slot=true
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
    --slotName)
        slot_name="${2}"
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

if ! tar -xf "${artifact_path}"; then
    echo "Error: extracting build artifact ${artifact_path}"
    exit 11
fi

function on_exit() {
    # always try to remove temporary access
    if [ ${deploy_slot} == true ] ; then
        az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${ruleName}" --scm-site true 1>/dev/null
    else
        az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --rule-name "${ruleName}" --scm-site true 1>/dev/null
    fi
}
trap on_exit EXIT

# allow build agent access to execute deployment
agentIp=$(curl -s --retry 3 --retry-delay 30 --retry-connrefused https://api.ipify.org)
ruleName="agent-${app_name:0:26}"
if [ ${deploy_slot} == true ] ; then
    az webapp config access-restriction add -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${ruleName}" --action Allow --ip-address "${agentIp}" --priority 232 --scm-site true 1>/dev/null
else
    az webapp config access-restriction add -g "${app_rg}" -n "${app_name}" --rule-name "${ruleName}" --action Allow --ip-address "${agentIp}" --priority 232 --scm-site true 1>/dev/null
fi

if ! pushd build; then
    echo "Error: unable to change working directory"
    exit 12
fi

# Gives some extra time for prior management operation to complete before starting deployment
sleep 15s

if [ ${deploy_slot} == true ] ; then
# az webapp up --html --os-type linux -n "${app_name}"
    az webapp deploy -g "${app_rg}" --src-path "${artifact_path}" -n "${app_name}" --slot "${slot_name}"
else
    az webapp deploy -g "${app_rg}" --src-path "${artifact_path}" -n "${app_name}"
fi


# Alternative workaround to set Azure app service container runtime

az webapp config set -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --linux-fx-version "PHP|8.2" 1>/dev/null
sleep 15s

az webapp config set -g "${app_rg}" -n "${app_name}" --linux-fx-version "PHP|8.2" 1>/dev/null

sleep 15s

popd
