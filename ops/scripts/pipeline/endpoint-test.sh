#!/usr/bin/env bash

# Title:        az-app-deploy.sh
# Description:  Helper script to deploy webapp build artifact to existing Azure site
# Usage:        ./endpoint-test.sh -resourceGroup resourceGroupName --webappName webappName --apiName apiName --slot slotName --hostSuffix hostSuffix
#
# Exitcodes
# ==========
# 0   No error
# 1   Script interrupted
# 2   Unknown flag or switch passed as parameter to script
# 10+ Validation check errors
set -euo pipefail # ensure job step fails in CI pipeline when error occurs

slot_name=''

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "./endpoint-test.sh -resourceGroup resourceGroupName --webappName webappName --apiName apiName --slot slotName --hostSuffix hostSuffix"
        exit 0
        ;;
    --resourceGroup)
        app_rg="${2}"
        shift 2
        ;;

    --apiName)
        api_name="${2}"
        shift 2
        ;;

    --webappName)
        webapp_name="${2}"
        shift 2
        ;;

    --hostSuffix)
        host_suffix="${2}"
        shift 2
        ;;

    --slotName)
        slot_name="${2}"
        shift 2
        ;;

    --stackName)
        stack_name="${2}"
        shift 2
        ;;

    --priority)
        priority="${2}"
        shift 2
        ;;
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

# shellcheck disable=SC1083 # REASON: Wants to quote http_code
webCmd="curl -q -o -I -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-connrefused -f https://${webapp_name}.azurewebsites${host_suffix}"
# shellcheck disable=SC1083 # REASON: Wants to quote http_code
apiCmd="curl -q -o -I -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-connrefused -f https://${api_name}.azurewebsites${host_suffix}/api/healthcheck"

if [[ -z ${slot_name} ]]; then
    ./dev-add-allowed-ip.sh -g "$app_rg" -s "$stack_name" -p "$priority" --is-cicd
    echo "No Slot Provided"
    webStatusCode=$($webCmd)
    apiStatusCode=$($apiCmd)
else
    ./slots/dev-add-allowed-ip.sh -g "$app_rg" -s "$stack_name" -p "$priority" --slot-name "$slot_name" --is-cicd
    webCmd="${webCmd}?x-ms-routing-name=${slot_name}"
    apiCmd="${webCmd}?x-ms-routing-name=${slot_name}"
    webStatusCode=$($webCmd)
    apiStatusCode=$($apiCmd)
fi

if [[ $webStatusCode = "200" && $apiStatusCode = "200" ]]; then
    echo "Responded 200"
    exit 0
else
    echo "Health check error. Response codes webStatusCode=$webStatusCode apiStatusCode=$apiStatusCode"
    exit 1
fi
