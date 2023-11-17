#!/usr/bin/env bash

# Description: Helper script to generate stack name for naming Azure resources
# Usage: generate-stackname.sh <environment:str> <application_name:str> <suffix:str> <branchName:str>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

environment=$1
application_name=$2
suffix=$3
branchName=$4

if [[ ${environment} == 'Main-Gov' ]]; then
    echo "${application_name}"
    exit 0
else
    stackname=${application_name}

    if [[ -n ${suffix} ]]; then
        stackname="${stackname}${suffix}"
    fi

    if [[ -n ${branchName} ]]; then
        if [[ $(uname) == "Darwin" ]]; then
            hash=$(echo -n "${branchName}" | openssl sha256 | awk '{print $1}')
        else
            hash=$(echo -n "${branchName}" | openssl sha256 | awk '{print $2}')
        fi
        short_hash=${hash:0:6}
        stackname="${stackname}-${short_hash}"
    fi
    echo "${stackname}"
    exit 0
fi
