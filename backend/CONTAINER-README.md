# Containerized Backend API

This document describes how to build, run, and deploy the containerized Express.js API that replaced
the Azure Functions implementation.

## Overview

The backend API has been migrated from Azure Functions to a standard Express.js application running
in containers. This provides better portability, local development experience, and deployment
flexibility.

## Quick Start

### Prerequisites

- Node.js 20+ (for local development)
- Podman or Docker
- Git

### Building and Running Locally

1. **Quick Start with Script:**

   ```bash
   ./build-and-run.sh
   ```

   This will:
   - Build the container image
   - Stop any existing container
   - Start a new container on port 8080
   - Test the health endpoint

2. **Manual Build:**

   ```bash
   # Build the image
   podman build -t bankruptcy-api -f Containerfile .

   # Run the container
   podman run -d --name bankruptcy-api-container -p 8080:80 -e PORT=80 bankruptcy-api
   ```

3. **Using Docker Compose:**
   ```bash
   docker-compose up --build
   ```

### Testing the Application

Once running, test the API:

```bash
# Health check
curl http://localhost:8080/api/healthcheck

# Example API endpoints (requires proper authentication)
curl http://localhost:8080/api/cases
curl http://localhost:8080/api/offices
```

## Container Details

### Image Structure

The Containerfile uses a multi-stage build:

1. **Builder Stage**: Installs dependencies and builds TypeScript
2. **Production Stage**: Creates optimized runtime image with only production dependencies

### Key Features

- **Non-root user**: Runs as `nextjs` user (UID 1001) for security
- **Health checks**: Built-in health check using the `/api/healthcheck` endpoint
- **Multi-arch support**: Uses Node.js Alpine for smaller image size
- **Optimized layers**: Separate dependency installation for better caching

### Environment Variables

| Variable                                 | Default    | Description                     |
| ---------------------------------------- | ---------- | ------------------------------- |
| `PORT`                                   | 80         | Port the application listens on |
| `NODE_ENV`                               | production | Node.js environment             |
| `COSMOS_DB_CONNECTION_STRING`            | -          | Azure Cosmos DB connection      |
| `SQL_CONNECTION_STRING`                  | -          | SQL Server connection           |
| `OKTA_DOMAIN`                            | -          | Okta authentication domain      |
| `APPLICATION_INSIGHTS_CONNECTION_STRING` | -          | Application Insights telemetry  |

## Development

### Local Development Without Containers

```bash
# Install dependencies
npm ci

# Build the application
npm run build:all

# Start in development mode
npm run start:express:dev
```

### Container Development Workflow

1. Make code changes
2. Run `./build-and-run.sh` to test changes
3. Use `podman logs -f bankruptcy-api-container` to view logs
4. Access container shell: `podman exec -it bankruptcy-api-container sh`

## Deployment

### CI/CD Integration

Use the `container-build.sh` script for automated builds:

```bash
# Build only
./container-build.sh

# Build with custom name/tag
./container-build.sh my-api v1.2.3

# Build and push to registry
./container-build.sh bankruptcy-api v1.2.3 your-registry.azurecr.io
```

### Azure Container Apps Deployment

The application is designed to work with Azure Container Apps:

1. **Container Registry**: Push image to Azure Container Registry
2. **Container App**: Deploy with proper environment variables
3. **Ingress**: Configure for HTTP traffic on port 80
4. **Scaling**: Set up auto-scaling rules based on HTTP requests

### Production Configuration

For production deployments:

```yaml
# Example Container App configuration
containers:
  - name: bankruptcy-api
    image: your-registry.azurecr.io/bankruptcy-api:latest
    env:
      - name: PORT
        value: '80'
      - name: NODE_ENV
        value: 'production'
      - name: COSMOS_DB_CONNECTION_STRING
        secretRef: cosmos-connection-string
    resources:
      cpu: 1.0
      memory: 2Gi
    probes:
      - type: Liveness
        httpGet:
          path: /api/healthcheck
          port: 80
        initialDelaySeconds: 30
      - type: Readiness
        httpGet:
          path: /api/healthcheck
          port: 80
        initialDelaySeconds: 10
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change the host port in run commands if 8080 is in use
2. **Permission issues**: Ensure scripts are executable (`chmod +x script-name.sh`)
3. **Build failures**: Check that all dependencies in package.json are available
4. **Health check failures**: Verify environment variables and external dependencies

### Debugging

```bash
# View container logs
podman logs -f bankruptcy-api-container

# Access container shell
podman exec -it bankruptcy-api-container sh

# Check running processes
podman ps

# Inspect container
podman inspect bankruptcy-api-container
```

### Performance Monitoring

- **Health endpoint**: `/api/healthcheck` provides system status
- **Application Insights**: Integrated for telemetry and monitoring
- **Container metrics**: Available through container runtime

## Migration Notes

This containerized version maintains API compatibility with the previous Azure Functions
implementation:

- Same HTTP endpoints and response formats
- Same authentication and authorization mechanisms
- Same database and external service integrations
- Same error handling and logging patterns

The main differences:

- Runs on standard HTTP server instead of Azure Functions runtime
- Uses container orchestration instead of serverless scaling
- Requires explicit port binding and health checks
