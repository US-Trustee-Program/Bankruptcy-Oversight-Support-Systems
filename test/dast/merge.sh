#!/bin/bash

# This script requires a ,env file containing these variables:
#   BASE_URL
#   OKTA_USERNAME
#   OKTA_PASSWORD

set -a
# shellcheck source=/dev/null
source .env
set +a

envsubst < templates/cams-ui.context.template > cams-ui.context
envsubst < templates/okta-auth.zst.template > okta-auth.zst
