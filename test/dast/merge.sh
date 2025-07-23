#!/bin/bash

# This script requires a ,env file containing these variables:
#   BASE_URL
#   OKTA_USERNAME
#   OKTA_PASSWORD

# Check if .env file exists before sourcing it
if [ -f .env ]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
else
    echo ".env file not found, continuing without it"
fi

envsubst < templates/cams-ui.context.template > config/cams-ui.context
envsubst < templates/okta-auth.zst.template > config/okta-auth.zst
