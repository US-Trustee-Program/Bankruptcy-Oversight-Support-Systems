# Technical Migration Plan: Azure Functions → Container Apps

## Overview

This document outlines the technical plan for migrating the backend API from Azure Functions to
Azure Container Apps while minimizing workflow disruption.

## Technical Migration Plan: Functions → Container Apps

### 1. Application Code Changes

#### Containerization of Node.js API

- **Dockerfile Creation**: Create a Dockerfile that packages the Node.js API as a web server instead
  of Azure Functions runtime
- **HTTP Server Implementation**: Replace Azure Functions HTTP triggers with Express.js or similar
  web framework
- **Port Configuration**: Ensure the container listens on the correct port (typically 80 or
  configurable via environment variable)
- **Health Endpoints**: Implement `/health` and `/ready` endpoints for container health checks

#### Function Trigger Conversion

- **HTTP Triggers**: Convert to standard REST API endpoints
- **Timer Triggers**: Migrate to scheduled jobs within the container or external orchestration
- **Storage/Queue Triggers**: Replace with polling mechanisms or webhook patterns

### 2. Infrastructure Changes (Bicep)

#### Replace Function App Module

- **New Module**: Create `backend-container-app-deploy.bicep` to replace `backend-api-deploy.bicep`
- **Container Apps Environment**: Deploy Azure Container Apps Environment with:
  - VNet integration to existing `apiFunctionSubnetId`
  - Log Analytics workspace integration
  - Private networking configuration

#### Key Infrastructure Components

```
Azure Container App:
├── Container Apps Environment (shared runtime)
├── Container App (replaces Function App)
├── Container Registry (for image storage)
├── Managed Identity (for authentication)
└── Application Insights (existing integration)
```

#### Networking Alignment

- **Subnet Reuse**: Leverage existing `apiFunctionSubnetId` for Container Apps Environment
- **Private Endpoints**: Maintain existing private endpoint configuration
- **DNS Integration**: Keep existing private DNS zone setup

### 3. Build Pipeline Changes

#### Container Image Build

- **Docker Build Step**: Add container image build to `sub-build.yml`
- **Image Registry**: Push to Azure Container Registry (ACR)
- **Image Tagging**: Use commit SHA or build number for versioning
- **Multi-stage Build**: Optimize for production with minimal runtime image

#### Artifact Changes

- **Replace ZIP Package**: Instead of function app ZIP, produce container image
- **Registry Authentication**: Configure ACR authentication in pipeline
- **Image Scanning**: Integrate container vulnerability scanning

### 4. Deployment Strategy Adaptation

#### Blue-Green with Revisions

Container Apps support revision-based deployments:

- **Revision Creation**: New container image creates new revision
- **Traffic Splitting**: Gradually shift traffic from old to new revision
- **Rollback Capability**: Quick rollback to previous revision if needed

#### Deployment Script Changes

- **Replace `az-func-deploy.sh`**: Create `az-container-deploy.sh` for container deployments
- **Image Deployment**: Deploy by updating container app with new image reference
- **Configuration Updates**: Handle environment variables and secrets

### 5. Configuration and Secrets Management

#### Environment Variables

- **Function Settings → Container Environment**: Map existing function app settings to container
  environment variables
- **Key Vault Integration**: Maintain existing Key Vault integration via managed identity
- **Runtime Configuration**: Adapt any Functions-specific configurations

#### Networking Configuration

- **Ingress Configuration**: Configure Container Apps ingress for HTTP traffic
- **Internal/External Access**: Maintain existing access patterns
- **Custom Domains**: Migrate any custom domain configurations

### 6. Monitoring and Observability

#### Application Insights Integration

- **Maintain Existing**: Keep current Application Insights integration
- **Custom Metrics**: Adapt any Functions-specific metrics to container metrics
- **Distributed Tracing**: Ensure tracing works across container boundaries

#### Health Monitoring

- **Container Health Probes**: Implement liveness and readiness probes
- **Startup Probes**: Handle application startup time requirements

### 7. Scaling Configuration

#### Auto-scaling Rules

- **HTTP Scaling**: Configure based on HTTP request volume
- **Custom Metrics**: Use Application Insights metrics for scaling decisions
- **Scale-to-Zero**: Enable scale-to-zero for non-production environments

### 8. Parameter and Variable Updates

#### Bicep Parameter Changes

```bicep
// Replace
param apiFunctionName string
param apiFunctionPlanName string

// With
param apiContainerAppName string
param containerAppsEnvironmentName string
param containerRegistryName string
```

#### Pipeline Variable Updates

- **Naming Convention**: Update variables to reflect container terminology
- **Registry Configuration**: Add container registry connection details
- **Image Names**: Standardize image naming conventions

### 9. Testing Strategy

#### Container-Specific Tests

- **Container Health**: Test container startup and health endpoints
- **Port Binding**: Verify correct port exposure and binding
- **Environment Variable Loading**: Test configuration injection

#### Deployment Testing

- **Revision Deployment**: Test revision creation and traffic splitting
- **Rollback Testing**: Verify rollback to previous revision works
- **Scale Testing**: Validate auto-scaling behavior

### 10. Backward Compatibility Considerations

#### API Contract Maintenance

- **HTTP Endpoints**: Ensure API endpoints remain unchanged
- **Response Formats**: Maintain existing response structures
- **Authentication**: Preserve existing authentication mechanisms

#### External Integrations

- **Webhook URLs**: Update any external systems pointing to function URLs
- **Internal Service Discovery**: Update service-to-service communication endpoints

### Implementation Priority

1. **Phase 1**: Container app infrastructure and basic deployment
2. **Phase 2**: Blue-green deployment with revisions
3. **Phase 3**: Monitoring, scaling, and optimization
4. **Phase 4**: Performance tuning and cost validation

This plan maintains the existing workflow structure while replacing the underlying compute model,
minimizing disruption to the CI/CD pipeline and operational processes.
