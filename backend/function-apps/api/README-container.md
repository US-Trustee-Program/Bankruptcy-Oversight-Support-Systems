# CAMS API Container Setup

This directory contains the containerized version of the CAMS API, migrated from Azure Functions to
a standard Express.js application running in a container.

## Quick Start

### Prerequisites

- Docker installed and running
- Node.js 20+ (for local development)

### Build and Run Container

From the `backend/function-apps/api` directory:

```bash
# Build the container
./build-container.sh

# Build and run immediately for testing
./build-container.sh cams-api latest --run
```

### Container Details

- **Base Image**: `node:20-alpine`
- **Port**: 7071
- **Health Check**: `/health`
- **Readiness Check**: `/ready`
- **API Base Path**: `/api`

### Environment Variables

The container accepts the same environment variables as the original Azure Functions:

```bash
docker run -p 7071:7071 \
  -e CAMS_LOGIN_PROVIDER=mock \
  -e DATABASE_MOCK=true \
  -e NODE_ENV=development \
  cams-api:latest
```

### API Endpoints

All original function endpoints are preserved with `/api` prefix:

- `GET /health` - Container health check
- `GET /ready` - Container readiness check
- `GET /api/healthcheck` - Application health check (includes DB connectivity)
- `GET /api/cases` - Cases endpoint
- `GET /api/cases/:caseId` - Specific case
- Plus all other existing function endpoints...

### Architecture Changes

#### What Changed

- **Runtime**: Azure Functions → Express.js server
- **Triggers**: HTTP triggers → Express routes
- **Packaging**: ZIP deployment → Container image
- **Scaling**: Function App scaling → Container Apps scaling

#### What Stayed the Same

- **Controllers**: All business logic controllers remain unchanged
- **Database**: Same database adapters and connections
- **Authentication**: Same auth mechanisms
- **API Contracts**: Same request/response formats
- **Environment Variables**: Same configuration approach

### Development Workflow

#### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build:container

# Start container server
npm run start:container
```

#### Container Testing

```bash
# Build container
./build-container.sh cams-api dev --run

# Check health
curl http://localhost:7071/health
curl http://localhost:7071/ready
curl http://localhost:7071/api/healthcheck

# View logs
docker logs -f cams-api-test
```

### Files Added for Container Support

- `Containerfile` - Multi-stage container build
- `container-server.js` - Express.js server replacing Functions host
- `container-routes.js` - Route aggregator for function handlers
- `build-container.sh` - Build and test script
- `README-container.md` - This documentation

### Container Build Process

1. **Builder Stage**:
   - Install dependencies from backend and common modules
   - Install Express.js dependencies for API
   - Build TypeScript → JavaScript
   - Build common and API modules

2. **Production Stage**:
   - Copy built artifacts
   - Copy container server files
   - Set up non-root user
   - Configure health checks
   - Start Express.js server

### Migration Notes

The container approach provides:

✅ **Cost Savings**: Scale-to-zero capability in non-production environments
✅ **Flexibility**: Standard container deployment patterns
✅ **Consistency**: Same runtime behavior across environments
✅ **Compatibility**: Existing API contracts and business logic preserved

### Deployment Integration

This container can be deployed to:

- Azure Container Apps (primary target)
- Azure Container Instances
- Any Kubernetes cluster
- Docker Swarm
- Local development environments

The existing CI/CD pipeline will be updated to build and push container images instead of ZIP
packages.
