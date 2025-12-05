# Docker Container for CI/CD

## Overview

CAMS provides a Docker container for running tests and producing deployment artifacts in a consistent, reproducible environment. This container is designed for use in Azure DevOps pipelines to test, build, and package the application.

## Building the Container

```bash
# From repository root
docker build -f .github/docker/Dockerfile.build-and-test -t cams-build:latest .
```

### Testing the Container

After building or making changes to the Dockerfile, run the comprehensive test suite:

```bash
# From repository root
./.github/docker/test-dockerfile.sh
```

This script verifies:
- Docker image builds successfully
- Node.js and system dependencies are correctly installed
- Environment variables are properly configured
- Common, backend, and frontend tests pass
- Artifact production works correctly
- Image size is reasonable

**Expected output**: All tests should pass with green checkmarks.

## Pre-configured Environment

The container comes with the following pre-installed:

### System Dependencies
- Node.js v22.17.1
- npm v10.9.2
- zip/unzip utilities
- git
- ca-certificates

### Environment Variables

**Pre-configured in Container**:
- `CI=true` - Indicates CI environment
- `NPM_CONFIG_LOGLEVEL=warn` - Reduces npm log verbosity

**NOT Pre-configured** (set by test scripts in package.json):
- Test-specific environment variables (`CAMS_LOGIN_PROVIDER=mock`, `DATABASE_MOCK=true`, etc.) are explicitly set by npm scripts
- This prevents accidental use of test values in production builds
- Each module's `package.json` defines the exact values used in its test scripts

## Common Usage

### Running All Tests

```bash
docker run --rm cams-build:latest bash -c "\
  cd common && npm ci && npm run coverage:ci && \
  cd ../backend && npm run build-common && npm ci && npm run coverage:ci && \
  cd ../user-interface && npm run build-common && npm ci && npm run coverage:ci"
```

**Expected Output**:
- Common: 24 test suites, 383 tests (~5 seconds)
- Backend: 120 test suites, 985 tests (~20 seconds)
- Frontend: Test results with coverage reports

### Running Tests for Individual Modules

**Common Library**:
```bash
docker run --rm cams-build:latest bash -c "\
  cd common && npm ci && npm test"
```

**Backend**:
```bash
docker run --rm cams-build:latest bash -c "\
  cd common && npm ci && npm run build && \
  cd ../backend && npm ci && npm test"
```

**Frontend**:
```bash
docker run --rm cams-build:latest bash -c "\
  cd common && npm ci && npm run build && \
  cd ../user-interface && npm ci && npm test"
```

### Producing Deployment Artifacts

```bash
docker run --rm \
  -e API_FUNCTION_NAME=cams-api-prod \
  -e DATAFLOWS_FUNCTION_NAME=cams-dataflows-prod \
  -v $(pwd)/artifacts:/workspace/backend/function-apps \
  cams-build:latest bash -c "\
    cd common && npm ci && npm run build && \
    cd ../backend && npm ci && npm run build:all && \
    OUT=\$API_FUNCTION_NAME npm run pack:api && \
    OUT=\$DATAFLOWS_FUNCTION_NAME npm run pack:dataflows"
```

**Output Artifacts**:
- `backend/function-apps/api/cams-api-prod.zip` (~52MB)
- `backend/function-apps/dataflows/cams-dataflows-prod.zip` (~52MB)

**Artifact Contents**:
- `dist/` - Compiled JavaScript
- `node_modules/` - Production dependencies
- `package.json` - Package metadata
- `host.json` - Azure Functions configuration

### Interactive Debugging

```bash
# Drop into a shell for debugging
docker run --rm -it cams-build:latest bash

# Inside container:
cd common && npm ci && npm test
cd ../backend && npm ci && npm run build
```

## CI/CD Pipeline Integration

### Environment Variables to Override

For production builds, override these variables:

```bash
docker run --rm \
  -e CAMS_SERVER_HOSTNAME=your-api.azurewebsites.us \
  -e CAMS_SERVER_PORT=443 \
  -e CAMS_SERVER_PROTOCOL=https \
  -e CAMS_BASE_PATH=/api \
  -e CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=..." \
  -e CAMS_FEATURE_FLAG_CLIENT_ID="your-ld-client-id" \
  -e CAMS_LAUNCH_DARKLY_ENV="production" \
  -e CAMS_LOGIN_PROVIDER=okta \
  -e CAMS_LOGIN_PROVIDER_CONFIG='{"issuer":"https://...","clientId":"..."}' \
  -e CAMS_INFO_SHA="$GIT_SHA" \
  cams-build:latest bash -c "cd user-interface && npm ci && npm run build"
```

### Mounting Volumes

```bash
# Mount artifacts directory to extract results
docker run --rm \
  -v $(pwd)/coverage:/workspace/coverage \
  -v $(pwd)/artifacts:/workspace/artifacts \
  cams-build:latest bash -c "npm test && npm run build"
```

## Performance Considerations

### Docker Layer Caching

The Dockerfile is optimized for layer caching:

1. Base image and system dependencies (rarely changes)
2. Package files (changes with dependency updates)
3. npm install (cached unless package files change)
4. Source code (changes frequently, but doesn't invalidate earlier layers)

**Recommendation**: Use a Docker registry (Azure Container Registry, Docker Hub) to share built images across pipeline runs.

### Build Time Optimization

**First Build**: ~2-3 minutes
**Subsequent Builds** (with cache): ~30 seconds (if only source code changed)

```bash
# Push to registry after building
docker tag cams-build:latest myregistry.azurecr.io/cams-build:latest
docker push myregistry.azurecr.io/cams-build:latest

# Pull in CI/CD pipeline
docker pull myregistry.azurecr.io/cams-build:latest
```

## Troubleshooting

### Container Fails to Build

**Issue**: npm install fails during image build

**Solution**: Check that package-lock.json files are committed for all modules (common, backend, user-interface)

### Tests Fail in Container but Pass Locally

**Issue**: Environment differences between local and container

**Solution**: Verify environment variables match. Use `docker run --rm cams-build:latest env` to inspect.

### Artifacts Are Missing Dependencies

**Issue**: node_modules not included or incomplete in artifact zip

**Solution**: Ensure `npm ci` completes successfully before running `npm run pack:api`

### Permission Errors with Volume Mounts

**Issue**: Files created in container are owned by root

**Solution**: Either run container with `--user $(id -u):$(id -g)` or change ownership after extraction:
```bash
sudo chown -R $(whoami):$(whoami) artifacts/
```

## Maintenance

### Updating Node.js Version

1. Update `.nvmrc` in repository root
2. Update `FROM` line in `.github/docker/Dockerfile.build-and-test`
3. Rebuild container: `docker build -f .github/docker/Dockerfile.build-and-test -t cams-build:latest .`
4. **Run test script**: `./.github/docker/test-dockerfile.sh` to verify all tests pass
5. Update this documentation with new version

**Note**: Node.js version updates via Renovate are currently disabled (see ADR for rationale).

### Updating System Dependencies

Edit the `apt-get install` section in the Dockerfile:

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    zip \
    unzip \
    git \
    ca-certificates \
    # Add new dependencies here
    && rm -rf /var/lib/apt/lists/*
```

After making changes:
1. Rebuild the container
2. **Run test script**: `./.github/docker/test-dockerfile.sh` to verify changes work correctly

## Security Considerations

- Container does not include secrets or credentials
- All sensitive values must be passed as environment variables at runtime
- Base image receives security updates from Node.js official images
- Consider scanning images with tools like Trivy or Snyk before use in production pipelines
