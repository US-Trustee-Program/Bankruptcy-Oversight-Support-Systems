#!/usr/bin/env bash

# Description: Helper script to set the login provider configuration for mock login

set -eou pipefail

camsLoginProvider=$1
camsLoginProviderConfig=$2
apiName=$3

loginProviderConfigOutput=$camsLoginProviderConfig

if [[ $camsLoginProvider == 'mock' ]]; then
    # shellcheck disable=SC2089 # REASON: We need to retain the single quotes
    loginProviderConfigOutput='{ "issuer": "https://'$apiName'.azurewebsites.us/api/oauth2/default" }'
fi

echo "$loginProviderConfigOutput"
