#!/usr/bin/env bash

# Title:        az-app-slot-deploy.sh
# Description:  Helper script to deploy webapp build artifact to existing Azure slot
# Usage:        ./az-app-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n webappName --networkRg networkRgName --vnet vnetName --subnet subnetName --slotName slotName
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
        echo "USAGE: az-app-slot-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --slotName slotName"
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

function on_exit() {
    # always try to remove temporary access
    az webapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${rule_name}" --scm-site true 1>/dev/null

}
trap on_exit EXIT

# allow build agent access to execute deployment
agent_ip=$(curl -s --retry 3 --retry-delay 30 --retry-all-errors https://api.ipify.org)
rule_name="agent-${app_name:0:26}"
echo "Adding rule: ${rule_name} to webapp"
az webapp config access-restriction add -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${rule_name}" --action Allow --ip-address "${agent_ip}" --priority 232 --scm-site true 1>/dev/null

# Gives some extra time for prior management operation to complete before starting deployment
sleep 10
az webapp deploy --resource-group "${app_rg}" --src-path "${artifact_path}" --name "${app_name}" --slot "${slot_name}" --type zip --async true
