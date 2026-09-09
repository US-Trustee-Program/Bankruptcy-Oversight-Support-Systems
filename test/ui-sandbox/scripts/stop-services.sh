#!/bin/bash
# Tear down the ui-sandbox MongoDB and SQL Edge containers.
set -e
podman rm -f cams-ui-sandbox-mongodb cams-ui-sandbox-sqledge 2>/dev/null || true
echo "Stopped."
