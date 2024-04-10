#!/usr/bin/env bash

# Title:        endpoint-test.sh
# Description:  Verify 200 response from frontend and backend
# Usage:        ./endpoint-test.sh --webappName webappName --apiName apiName --slot slotName --hostSuffix hostSuffix
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
        echo "./endpoint-test.sh --webappName webappName --apiName apiName --slot slotName --hostSuffix hostSuffix"
        exit 0
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
    *)
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

webStatusCode=""
apiStatusCode=""
targetApiURL="https://${api_name}.azurewebsites${host_suffix}/api/healthcheck"
targetWebAppURL="https://${webapp_name}.azurewebsites${host_suffix}"
# shellcheck disable=SC1083 # REASON: Wants to quote http_code
webCmd="curl -q -o /dev/null -I -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-all-errors -f ${targetWebAppURL}"
# shellcheck disable=SC1083 # REASON: Wants to quote http_code
apiCmd="curl -q -o /dev/null -L -s -w "%{http_code}" --retry 5 --retry-delay 60 --retry-all-errors -f ${targetApiURL}"

if [[ -z ${slot_name} ]]; then
  echo "No Slot Provided"
  webStatusCode=$($webCmd)
  apiStatusCode=$($apiCmd)
else
  webCmd="${webCmd}?x-ms-routing-name=${slot_name}"
  apiCmd="${apiCmd}?x-ms-routing-name=${slot_name}"
  webStatusCode=$($webCmd)
  apiStatusCode=$($apiCmd)
  targetApiURL+="?x-ms-routing-name=${slot_name}"
fi

if [[ $webStatusCode = "200" && $apiStatusCode = "200" ]]; then
  echo "Print api healthcheck response"
  curl "${targetApiURL}"
  echo ""
  exit 0
else
  echo "Health check error. Response codes webStatusCode=$webStatusCode apiStatusCode=$apiStatusCode"
  exit 1
fi
