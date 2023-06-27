#!/usr/bin/env bash

# Description: Helper script to generate stack name for naming Azure resources
# Usage: generate-stackname.sh <environment:str> <application_name:str> <suffix:str> <branchName:str>

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

if [[ $1 == 'Main-Gov' ]]; then
    echo $2
    exit 0
else
    stackname=$2

    if [[ -n $3 ]]; then
        stackname="${stackname}$3"
    fi

    if [[ -n $4 ]]; then
        if [[ $(uname) == "Darwin" ]]; then
            hash=$(echo -n $4 | openssl sha256 | awk '{print $1}')
        else
            hash=$(echo -n $4 | openssl sha256 | awk '{print $2}')
        fi
        short_hash=${hash:0:6}
        stackname="${stackname}-$short_hash"
    fi
    echo $stackname
    exit 0
fi
