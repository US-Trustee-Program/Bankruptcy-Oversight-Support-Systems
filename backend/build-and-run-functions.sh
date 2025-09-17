#!/bin/bash

# Build and Run Script for Azure Functions Runtime Container
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="bankruptcy-api-functions"
CONTAINER_NAME="bankruptcy-api-functions-container"
PORT="7071"  # Standard Azure Functions port

echo -e "${GREEN}🐳 Building Azure Functions Container Image...${NC}"
echo "Image: $IMAGE_NAME"

# Build the container image from project root (to include common directory)
cd .. && podman build -t $IMAGE_NAME -f backend/Containerfile.functions .

echo -e "${GREEN}✅ Container image built successfully!${NC}"

# Stop and remove existing container if running
if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}🛑 Stopping existing container...${NC}"
    podman stop $CONTAINER_NAME
    podman rm $CONTAINER_NAME
    
    # Clean up existing secrets
    echo -e "${YELLOW}🔐 Cleaning up existing secrets...${NC}"
    for secret in $(podman secret ls --format "{{.Name}}" | grep "^${CONTAINER_NAME}_"); do
        echo "  🗑️  Removing secret: $secret"
        podman secret rm "$secret" >/dev/null 2>&1 || true
    done
fi

echo -e "${GREEN}🚀 Starting Azure Functions container...${NC}"
echo "Container will be available at: http://localhost:$PORT/api/healthcheck"

# Environment variables to load as secrets
ENV_VARS=(
    "ADMIN_KEY"
    "COSMOS_DATABASE_NAME"
    "COSMOS_ENDPOINT"
    "COSMOS_MANAGED_IDENTITY"
    "MONGO_CONNECTION_STRING"
    "DATABASE_MOCK"
    "MSSQL_HOST"
    "MSSQL_DATABASE"
    "MSSQL_DATABASE_DXTR"
    "MSSQL_USER"
    "MSSQL_PASS"
    "MSSQL_ENCRYPT"
    "MSSQL_TRUST_UNSIGNED_CERT"
    "ACMS_MSSQL_HOST"
    "ACMS_MSSQL_DATABASE"
    "ACMS_MSSQL_USER"
    "ACMS_MSSQL_PASS"
    "ACMS_MSSQL_ENCRYPT"
    "ACMS_MSSQL_TRUST_UNSIGNED_CERT"
    "FEATURE_FLAG_SDK_KEY"
    "CAMS_LOGIN_PROVIDER"
    "CAMS_LOGIN_PROVIDER_CONFIG"
    "CAMS_USER_GROUP_GATEWAY_CONFIG"
    "OKTA_API_KEY"
    "CAMS_ENABLED_DATAFLOWS"
)

ENV_FILE="./backend/function-apps/api/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}🔐 Creating Podman secrets from environment variables...${NC}"

# Clean up any existing secrets first
for var in "${ENV_VARS[@]}"; do
    secret_name="${CONTAINER_NAME}_$(echo "$var" | tr '[:upper:]' '[:lower:]')" # Convert to lowercase
    if podman secret exists "$secret_name" 2>/dev/null; then
        echo "  🗑️  Removing existing secret: $secret_name"
        podman secret rm "$secret_name" >/dev/null 2>&1 || true
    fi
done

# Create secrets from .env file
SECRET_ARGS=()
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comments and empty lines
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    
    # Remove leading/trailing whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    
    # Check if this key is in our list
    for var in "${ENV_VARS[@]}"; do
        if [[ "$key" == "$var" ]]; then
            secret_name="${CONTAINER_NAME}_$(echo "$key" | tr '[:upper:]' '[:lower:]')" # Convert to lowercase
            
            if [[ -n "$value" ]]; then
                echo "  🔑 Creating secret: $secret_name"
                echo -n "$value" | podman secret create "$secret_name" -
                SECRET_ARGS+=("--secret" "$secret_name,type=env,target=$key")
            else
                echo -e "${YELLOW}  ⚠️  Skipping empty value for: $key${NC}"
            fi
            break
        fi
    done
done < "$ENV_FILE"

# Run the container with secrets and Azure Functions runtime environment
podman run -d \
    --name $CONTAINER_NAME \
    -p $PORT:80 \
    "${SECRET_ARGS[@]}" \
    -e FUNCTIONS_WORKER_RUNTIME=node \
    -e AzureWebJobsScriptRoot=/home/site/wwwroot \
    -e AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    $IMAGE_NAME

# Wait a moment for the container to start
sleep 3

# Check if container is running
if podman ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}✅ Container started successfully!${NC}"
    echo -e "${GREEN}📊 Container Status:${NC}"
    podman ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo -e "\n${GREEN}🔍 Testing health endpoint...${NC}"
    sleep 10  # Azure Functions runtime takes longer to start
    
    if curl -f http://localhost:$PORT/api/healthcheck > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed!${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check not ready yet. Azure Functions runtime is starting...${NC}"
        echo -e "${YELLOW}    Try: curl http://localhost:$PORT/api/healthcheck${NC}"
        echo -e "${YELLOW}    Or check logs: podman logs -f $CONTAINER_NAME${NC}"
    fi
    
    echo -e "\n${GREEN}📋 Useful commands:${NC}"
    echo "  View logs:        podman logs -f $CONTAINER_NAME"
    echo "  Stop container:   podman stop $CONTAINER_NAME"
    echo "  Remove container: podman rm $CONTAINER_NAME"
    echo "  Health check:     curl http://localhost:$PORT/api/healthcheck"
    echo "  Shell access:     podman exec -it $CONTAINER_NAME sh"
    echo -e "\n${GREEN}🔐 Security commands:${NC}"
    echo "  List secrets:     podman secret ls | grep $CONTAINER_NAME"
    echo "  Clean secrets:    podman secret ls --format '{{.Name}}' | grep '^${CONTAINER_NAME}_' | xargs -r podman secret rm"
else
    echo -e "${RED}❌ Container failed to start${NC}"
    echo -e "${RED}Logs:${NC}"
    podman logs $CONTAINER_NAME
    exit 1
fi
