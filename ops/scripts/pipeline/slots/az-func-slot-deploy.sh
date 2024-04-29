#!/usr/bin/env bash

# Title:        az-func-slot-deploy.sh
# Description:  Helper script to deploy function build artifact to existing Azure slot
# Usage:        ./az-func-slot-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --networkRg networkRgName --vnet vnet --subnet subnetName --slotName slotName
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
        echo "USAGE: az-func-slot-deploy.sh -h --src ./path/build.zip -g resourceGroupName -n functionappName --slotName slotName --settings=\"key1=value1 key2=value2\""
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

    --slotName)
        slot_name="${2}"
        shift 2
        ;;

    --settings)
        app_settings="${2}"
        shift 2
        ;;

    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

# set rule_name in case of exit or other scenarios
rule_name="agent-${app_name:0:26}" # rule name has a 32 character limit

function on_exit() {
    # always try to remove temporary access
    az functionapp config access-restriction remove -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${rule_name}" --scm-site true 1>/dev/null

}
trap on_exit EXIT

if [ ! -f "$artifact_path" ]; then
    echo "Error: missing build artifact ${artifact_path}"
    exit 10
fi

# allow build agent access to execute deployment
agent_ip=$(curl -s --retry 3 --retry-delay 30 --retry-all-errors https://api.ipify.org)
echo "Adding rule: ${rule_name} to webapp"
az functionapp config access-restriction add -g "${app_rg}" -n "${app_name}" --slot "${slot_name}" --rule-name "${rule_name}" --action Allow --ip-address "${agent_ip}" --priority 232 --scm-site true 1>/dev/null

# Construct and execute deployment command
cmd="az functionapp deployment source config-zip -g ${app_rg} -n ${app_name} --slot ${slot_name} --src ${artifact_path}"
if [[ ${enable_debug} == 'true' ]]; then
    cmd="${cmd} --debug"
fi
echo "Deployment started"
eval "${cmd}"
echo "Deployment completed"

# configure Application Settings
if [[ -n ${app_settings} ]]; then
    echo "Set Application Settings for ${app_name}"
    # shellcheck disable=SC2086 # REASON: Adds unwanted quotes after --settings
    eval "az functionapp config appsettings set -g '${app_rg}' -n '${app_name}' --slot '$slot_name' --settings ${app_settings} --query '[].name' --output tsv"
fi
