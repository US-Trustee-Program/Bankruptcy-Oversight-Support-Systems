#!/usr/bin/env bash

# Title:        az-container-deploy.sh
# Description:  Helper script to deploy container app with blue-green deployment
# Usage:        ./az-container-deploy.sh -h --registry registryName --image imageName:tag -g resourceGroupName -n containerAppName

set -euo pipefail # ensure job step fails in CI pipeline when error occurs

enable_debug=false
traffic_percentage=100 # Default to 100% traffic to new revision

while [[ $# -gt 0 ]]; do
    case $1 in
    -h | --help)
        echo "USAGE: az-container-deploy.sh --registry registryName --image imageName:tag -g resourceGroupName -n containerAppName [--traffic percentage]"
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

    --registry)
        registry_name="${2}"
        shift 2
        ;;

    --image)
        image_name="${2}"
        shift 2
        ;;

    --traffic)
        traffic_percentage="${2}"
        shift 2
        ;;

    *)
        echo "Unknown option $1"
        exit 2 # error on unknown flag/switch
        ;;
    esac
done

# Validate required parameters
if [ -z "${app_rg:-}" ]; then
    echo "Error: Resource group (-g) is required"
    exit 10
fi

if [ -z "${app_name:-}" ]; then
    echo "Error: Container app name (-n) is required"
    exit 10
fi

if [ -z "${registry_name:-}" ]; then
    echo "Error: Registry name (--registry) is required"
    exit 10
fi

if [ -z "${image_name:-}" ]; then
    echo "Error: Image name (--image) is required"
    exit 10
fi

echo "Starting container app deployment..."
echo "Resource Group: ${app_rg}"
echo "Container App: ${app_name}"
echo "Registry: ${registry_name}"
echo "Image: ${image_name}"
echo "Traffic Percentage: ${traffic_percentage}%"

# Update the container app with new image
cmd="az containerapp update"
cmd+=" --resource-group ${app_rg}"
cmd+=" --name ${app_name}"
cmd+=" --image ${registry_name}.azurecr.us/${image_name}"

if [[ ${enable_debug} == 'true' ]]; then
    cmd="${cmd} --debug"
fi

echo "Updating container app with new image..."
eval "${cmd}"

# If traffic percentage is less than 100%, set up traffic splitting
if [ "${traffic_percentage}" -lt "100" ]; then
    echo "Setting up traffic splitting: ${traffic_percentage}% to new revision"

    # Get the latest revision name
    latest_revision=$(az containerapp revision list \
        --resource-group "${app_rg}" \
        --name "${app_name}" \
        --query '[0].name' \
        --output tsv)

    # Set traffic weights (this is a simplified approach)
    az containerapp ingress traffic set \
        --resource-group "${app_rg}" \
        --name "${app_name}" \
        --revision-weight "${latest_revision}=${traffic_percentage}"

    echo "Traffic splitting configured: ${traffic_percentage}% to revision ${latest_revision}"
else
    echo "Routing 100% traffic to new revision"
fi

echo "Container app deployment completed successfully!"
