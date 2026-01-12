# Azure Functions Deployment Troubleshooting Guide

**Purpose**: Guide for AI agents (like Claude Code) to diagnose and resolve Azure Functions deployment issues in the CAMS project.

**Context**: This project uses Azure Functions v4 with Node.js, esbuild for bundling, and deploys to Azure US Government Cloud.

---

## Step 0: Collect Required Variables from User

**IMPORTANT**: Before proceeding with any diagnostics, an AI agent MUST ask the user for these variables:

```bash
# Required Azure variables (DO NOT include defaults - these are sensitive)
RESOURCE_GROUP_NAME="<ask user>"
FUNCTION_APP_NAME="<ask user>"
SLOT_NAME="<ask user - typically 'development', 'staging', or 'production'>"

# Project root directory (can auto-detect from git)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

**Example prompt for AI agent**:
```
I need the following information to troubleshoot your Azure Functions deployment:

1. Azure Resource Group Name:
2. Azure Function App Name:
3. Deployment Slot Name (e.g., development, staging, production):

I'll use the current git repository root as the project root: ${PROJECT_ROOT}
```

Once collected, the AI agent should:
1. Store these in shell variables for the session
2. Substitute them into all commands below
3. Verify connectivity before proceeding

**Verification**:
```bash
# Export variables for use in subsequent commands
export RESOURCE_GROUP_NAME="<user-provided>"
export FUNCTION_APP_NAME="<user-provided>"
export SLOT_NAME="<user-provided>"
export PROJECT_ROOT=$(git rev-parse --show-toplevel)

# Verify Azure connectivity and access
az functionapp show \
  --name "${FUNCTION_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP_NAME}" \
  --query "{name:name, state:state, location:location}" \
  --output table

# If this fails, user needs to authenticate first (see Prerequisites Check below)
```

---

## Prerequisites Check

### Required Tools and Authentication

```bash
# Verify Azure CLI is installed and authenticated
az --version
# Expected: azure-cli version 2.x.x or higher

# Check current cloud setting
az cloud show --query name -o tsv
# Expected: AzureUSGovernment

# If not set to US Government cloud:
az cloud set --name AzureUSGovernment
az login
# This will open a browser for authentication

# Verify authentication and subscription
az account show --query "{subscription:name, user:user.name}"
# Expected: Should show valid subscription and user
```

### Podman (macOS Local Development Only)

```bash
# Check if Podman is installed (only needed on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  podman --version
  # Expected: podman version 5.x.x or higher

  # Check Podman machine status
  podman machine list
  # Expected: At least one machine should exist

  # If machine exists but not running (LAST UP shows "Never" or old date):
  podman machine start <machine-name>
  # Expected: "Machine '<machine-name>' started successfully"
fi
```

### Node.js Version

```bash
# Check Node.js version matches .nvmrc
cat "${PROJECT_ROOT}/.nvmrc"
# Expected: v22.17.1

node --version
# Expected: v22.x.x (should match or be compatible with .nvmrc)
```

---

## Problem: Functions Not Discovered (404 Errors)

### Symptoms to Detect

- Azure Portal shows "0 functions" under Functions blade
- HTTP requests return 404 for known endpoints (e.g., `/api/healthcheck`)
- Application Insights shows no function invocations
- Worker logs contain errors about module loading

### Diagnostic Commands

Execute these in order to identify the root cause:

#### 1. Check if Functions Are Listed in Azure Portal

```bash
# List function apps in resource group
az functionapp list \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --query "[].{name:name, state:state, location:location}" \
  --output table

# Get function count (replace placeholders)
az functionapp function list \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --query "length(@)"
# Expected: Should return number > 0 (e.g., 22 for API app)
# If returns 0: Functions are not being discovered
```

#### 2. Check Azure Functions v4 Feature Flag

```bash
# Check if worker indexing is enabled
az functionapp config appsettings list \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --query "[?name=='AzureWebJobsFeatureFlags'].{name:name, value:value}" \
  --output table

# Expected Output:
# Name                        Value
# AzureWebJobsFeatureFlags    EnableWorkerIndexing

# If missing or wrong value: ROOT CAUSE = Missing feature flag
```

**Fix for Missing Feature Flag**:
```bash
az functionapp config appsettings set \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --settings "AzureWebJobsFeatureFlags=EnableWorkerIndexing"

# Restart to apply changes
az functionapp restart \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME}

# Wait 30 seconds for restart
sleep 30

# Re-check function count
az functionapp function list \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --query "length(@)"
```

#### 3. Download and Inspect Application Logs

```bash
# Download logs to local temp directory
TIMESTAMP=$(date +%s)
LOG_FILE="/tmp/azure-logs-${TIMESTAMP}.zip"

az webapp log download \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --log-file "${LOG_FILE}"

# List contents to find worker logs
unzip -l "${LOG_FILE}" | grep -E "(docker\.log|Worker.*\.log)"

# Extract and search for module errors
unzip -p "${LOG_FILE}" "LogFiles/*_docker.log" 2>/dev/null \
  | grep -i "cannot find module" \
  | tail -20

# Common error patterns indicating ROOT CAUSE:
# - "Cannot find module '@azure/functions'" = Missing dependencies
# - "Cannot find module 'mongodb'" = Missing native module
# - "Cannot find module 'mssql'" = Missing native module
# - "invalid ELF header" = Wrong platform binaries (macOS instead of Linux)
```

#### 4. Inspect Deployment Package Contents

```bash
# Navigate to function app directory
cd ${PROJECT_ROOT}/backend/function-apps/api

# Check if deployment zip exists
if [ -f "*.zip" ]; then
  LATEST_ZIP=$(ls -t *.zip | head -1)

  # Verify node_modules is present
  unzip -l "${LATEST_ZIP}" | grep -c "node_modules/"
  # Expected: Should return large number (e.g., 16000+)
  # If returns 0: ROOT CAUSE = node_modules not packaged

  # Check for dist directory
  unzip -l "${LATEST_ZIP}" | grep -c "^dist/"
  # Expected: Should return number of bundled files (e.g., 50+)
  # If returns 0: ROOT CAUSE = Build did not run

  # Check for package.json
  unzip -l "${LATEST_ZIP}" | grep "package.json"
  # Expected: Should show package.json in root
  # If missing: ROOT CAUSE = Packaging script error

  # Verify native modules have .node files
  unzip -l "${LATEST_ZIP}" | grep "\.node$" | head -5
  # Expected: Should show platform-specific binary files
  # If none found but mongodb/mssql in package.json: May still work with JS fallback
fi
```

#### 5. Test Endpoint Directly

```bash
# Test healthcheck endpoint (adjust URL pattern for your deployment)
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "https://${FUNCTION_APP_NAME}-${SLOT_NAME}.azurewebsites.us/api/healthcheck")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: ${HTTP_CODE}"
echo "Response Body: ${BODY}"

# Expected: HTTP Status: 200, Body: JSON with status info
# If 404: Functions not loaded or wrong endpoint path
# If 403: IP restrictions blocking request
# If 500/502: Application error, check logs
```

#### 6. Check IP Access Restrictions

```bash
# Check main site access restrictions
az functionapp config access-restriction show \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --query "ipSecurityRestrictions[?action=='Deny']" \
  --output table

# Check SCM site access restrictions
az functionapp config access-restriction show \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --query "scmIpSecurityRestrictions[?action=='Deny']" \
  --output table

# If IP restrictions exist and you're blocked:
# Temporarily remove IP restriction for diagnostics (REMEMBER TO RESTORE)
az functionapp config access-restriction remove \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --rule-name <RULE_NAME>
```

---

## Root Causes and Fixes

### Root Cause 1: Missing AzureWebJobsFeatureFlags

**Symptoms**:
- `az functionapp function list` returns 0 functions
- Portal shows "0 functions"

**Diagnostic Confirmation**:
```bash
az functionapp config appsettings list \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --query "[?name=='AzureWebJobsFeatureFlags'].value" -o tsv
# If empty or not "EnableWorkerIndexing": This is the root cause
```

**Fix**:
```bash
az functionapp config appsettings set \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --settings "AzureWebJobsFeatureFlags=EnableWorkerIndexing" \
  && az functionapp restart \
       --name ${FUNCTION_APP_NAME} \
       --resource-group ${RESOURCE_GROUP_NAME} \
       --slot ${SLOT_NAME}
```

**Verification**:
Wait 30 seconds, then verify functions are now listed.

---

### Root Cause 2: Missing Dependencies in package.json

**Symptoms**:
- Logs show: `Cannot find module '@azure/functions'` or similar
- Functions listed but fail to load

**Diagnostic Confirmation**:
```bash
# Check if package.json has dependencies field
cat ${PROJECT_ROOT}/backend/function-apps/api/package.json \
  | grep -A 10 '"dependencies"'
# Should show: @azure/functions, mongodb, mssql, etc.
```

**Fix**:
Ensure `backend/function-apps/api/package.json` contains:
```json
{
  "dependencies": {
    "@azure/functions": "^4.10.0",
    "mongodb": "^6.12.0",
    "mssql": "^11.0.1",
    "dotenv": "^16.4.7",
    "express": "^5.2.1",
    "applicationinsights": "^3.4.0"
  }
}
```

Ensure `backend/function-apps/dataflows/package.json` contains the same dependencies.

**Then rebuild and redeploy**:
```bash
cd ${PROJECT_ROOT}/backend/function-apps/api
npm run clean
npm run build
npm run pack
# This creates a new .zip with dependencies included
```

---

### Root Cause 3: Platform Binary Mismatch (macOS vs Linux)

**Symptoms**:
- Logs show: `invalid ELF header` or architecture mismatch errors
- Functions fail to start even though modules are present
- Built on macOS but deployed to Linux Azure

**Diagnostic Confirmation**:
```bash
# Check if built on macOS without Podman
if [[ "$OSTYPE" == "darwin"* ]]; then
  # Check if node_modules contains macOS binaries
  # This is hard to detect without extracting, but if you see errors
  # about architecture, this is likely the issue
  echo "Running on macOS - must use Podman for packaging"
fi
```

**Fix for macOS**:
```bash
# Ensure Podman machine is running
podman machine list
# If not running:
podman machine start <machine-name>

# Clean and rebuild with Podman
cd ${PROJECT_ROOT}/backend/function-apps/api
npm run clean
npm run build
npm run pack
# The pack.sh script will detect macOS and use Podman automatically
```

**Fix for CI/CD**:
CI/CD runs on Linux (GitHub Actions uses ubuntu-latest), so this should not be an issue.
The `pack.sh` script detects Linux and builds directly.

---

### Root Cause 4: node_modules Not Included in Deployment

**Symptoms**:
- Logs show module errors
- Inspecting zip shows no node_modules directory

**Diagnostic Confirmation**:
```bash
cd ${PROJECT_ROOT}/backend/function-apps/api
LATEST_ZIP=$(ls -t *.zip | head -1)
unzip -l "${LATEST_ZIP}" | grep -c "node_modules/"
# If returns 0: node_modules not packaged
```

**Fix**:
```bash
# The pack.sh script should handle this automatically
# Verify the script is being called correctly:
cd ${PROJECT_ROOT}/backend
cat pack.sh | grep -A 5 "node_modules"
# Should show commands that install dependencies and include them in zip

# Rebuild with explicit pack command
cd ${PROJECT_ROOT}/backend/function-apps/api
npm run pack
# This runs ../../pack.sh api

# Verify node_modules is now in zip
LATEST_ZIP=$(ls -t *.zip | head -1)
unzip -l "${LATEST_ZIP}" | grep -c "node_modules/"
# Should return large number
```

---

## Architecture Reference

### File Structure

```
${PROJECT_ROOT}/
├── .nvmrc                                    # Node version: v22.17.1
├── backend/
│   ├── esbuild-shared.mjs                    # Shared esbuild config
│   ├── pack.sh                               # OS-aware packaging script
│   ├── Dockerfile.build                      # Linux container for building deps
│   └── function-apps/
│       ├── api/
│       │   ├── esbuild.config.mjs            # API esbuild entry points
│       │   ├── package.json                  # MUST have dependencies field
│       │   ├── index.ts                      # Entry point, loads all functions
│       │   ├── host.json                     # Azure Functions config
│       │   └── dist/                         # Output directory (created by build)
│       └── dataflows/
│           ├── esbuild.config.mjs            # Dataflows esbuild config
│           ├── package.json                  # MUST have dependencies field
│           ├── dataflows.ts                  # Entry point
│           ├── host.json                     # Azure Functions config
│           └── dist/                         # Output directory (created by build)
└── .github/workflows/
    ├── sub-build.yml                         # CI/CD build workflow
    └── sub-deploy-code-slot.yml              # CI/CD deployment workflow
```

### esbuild Strategy

**File**: `backend/esbuild-shared.mjs`

```javascript
export const EXTERNAL_DEPENDENCIES = [
  '@azure/functions',  // Cannot be bundled (dynamic requires)
  'mssql',            // Native module (platform-specific binary)
  'mongodb',          // Native module (platform-specific binary)
  'applicationinsights',
  'dotenv',
  'express',
];
```

**What gets bundled**:
- Code from `@common/*` path aliases → Resolved and bundled into output
- Local TypeScript files → Transpiled and bundled

**What stays external**:
- All third-party npm packages → Included as node_modules in deployment zip

### pack.sh Logic Flow

```bash
# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # CI/CD path: Already on Linux
  cd function-apps/<app>
  npm install --production

elif [[ "$OSTYPE" == "darwin"* ]]; then
  # Local development: Use Podman to build on Linux
  podman build -t cams-<app>-builder:latest -f Dockerfile.build \
    --build-arg FUNCTION_APP=<app> .
  podman cp <container>:/build/node_modules function-apps/<app>/
fi

# Create zip with dist/ + node_modules/
zip -r <app>.zip ./dist ./node_modules ./package.json ./host.json
```

### Deployment Zip Contents

A correct deployment zip should contain:

```
api.zip
├── dist/
│   ├── index.js                 # Entry point that registers all functions
│   ├── healthcheck/
│   │   └── healthcheck.function.js
│   ├── cases/
│   │   └── cases.function.js
│   └── [20 more function directories]
├── node_modules/
│   ├── @azure/
│   │   └── functions/           # Required for v4 programming model
│   ├── mongodb/                 # With Linux .node binaries
│   ├── mssql/                   # With Linux .node binaries
│   └── [368 other packages]
├── package.json                 # With dependencies field
└── host.json                    # Azure Functions config
```

---

## Rebuild and Redeploy Procedure

### Local Development (macOS)

```bash
# 1. Ensure Podman is running
podman machine list | grep "Currently running"
# If not running:
podman machine start <machine-name>

# 2. Navigate to function app
cd ${PROJECT_ROOT}/backend/function-apps/api

# 3. Clean previous build
npm run clean

# 4. Build (esbuild bundles @common, marks deps external)
npm run build

# 5. Package (installs deps in Linux container, creates zip)
npm run pack

# 6. Verify zip contents
LATEST_ZIP=$(ls -t *.zip | head -1)
echo "Checking ${LATEST_ZIP}..."
unzip -l "${LATEST_ZIP}" | grep -E "dist/|node_modules/|package.json"

# 7. Deploy to Azure
az functionapp deployment source config-zip \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --name ${FUNCTION_APP_NAME} \
  --slot ${SLOT_NAME} \
  --src "${LATEST_ZIP}" \
  --build-remote false \
  --timeout 600

# 8. Restart function app
az functionapp restart \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME}

# 9. Wait and test
sleep 30
curl "https://${FUNCTION_APP_NAME}-${SLOT_NAME}.azurewebsites.us/api/healthcheck"
```

### CI/CD (GitHub Actions)

The workflow automatically:

1. Runs on `ubuntu-latest` (Linux)
2. Executes `npm run build:backend` (esbuild)
3. Executes `npm run pack:api` (npm install on Linux)
4. Uploads artifact
5. Deploys via `ops/scripts/pipeline/slots/az-func-slot-deploy.sh`

**Key workflow files**:
- `.github/workflows/sub-build.yml` - Lines 73-85
- `.github/workflows/sub-deploy-code-slot.yml` - Lines 112-120

---

## Verification Checklist

After any fix, verify all these conditions:

```bash
# 1. Functions are listed in Azure
az functionapp function list \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --query "length(@)"
# Expected: > 0 (e.g., 22)

# 2. Healthcheck returns 200
curl -w "\nHTTP: %{http_code}\n" \
  "https://${FUNCTION_APP_NAME}-${SLOT_NAME}.azurewebsites.us/api/healthcheck"
# Expected: HTTP: 200 with JSON body

# 3. No errors in recent logs
LOG_FILE="/tmp/azure-logs-$(date +%s).zip"
az webapp log download \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --log-file "${LOG_FILE}"

unzip -p "${LOG_FILE}" "LogFiles/*_docker.log" 2>/dev/null \
  | grep -i "error" \
  | tail -10
# Expected: No "Cannot find module" or "Worker unable to load" errors

# 4. Feature flag is set
az functionapp config appsettings list \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --query "[?name=='AzureWebJobsFeatureFlags'].value" -o tsv
# Expected: EnableWorkerIndexing
```

---

## Common Patterns for AI Agents

### Pattern 1: User Reports "Functions Not Working"

```bash
# Execute this diagnostic sequence:

# Step 1: Check if functions are listed
FUNCTION_COUNT=$(az functionapp function list \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --query "length(@)" -o tsv)

if [ "$FUNCTION_COUNT" -eq 0 ]; then
  echo "ROOT CAUSE: Functions not discovered"

  # Check feature flag
  FEATURE_FLAG=$(az functionapp config appsettings list \
    --name ${FUNCTION_APP_NAME} \
    --resource-group ${RESOURCE_GROUP_NAME} \
    --slot ${SLOT_NAME} \
    --query "[?name=='AzureWebJobsFeatureFlags'].value" -o tsv)

  if [ "$FEATURE_FLAG" != "EnableWorkerIndexing" ]; then
    echo "FIX: Set AzureWebJobsFeatureFlags=EnableWorkerIndexing"
    # Apply fix from Root Cause 1 section
  fi
else
  echo "Functions are listed, checking endpoint..."
  # Continue to Step 2
fi
```

### Pattern 2: User Reports "Module Not Found Errors"

```bash
# Download and inspect logs
LOG_FILE="/tmp/azure-logs-$(date +%s).zip"
az webapp log download \
  --name ${FUNCTION_APP_NAME} \
  --resource-group ${RESOURCE_GROUP_NAME} \
  --slot ${SLOT_NAME} \
  --log-file "${LOG_FILE}"

# Check for module errors
MODULE_ERRORS=$(unzip -p "${LOG_FILE}" "LogFiles/*_docker.log" 2>/dev/null \
  | grep -i "cannot find module")

if [ ! -z "$MODULE_ERRORS" ]; then
  echo "ROOT CAUSE: Missing dependencies"
  echo "Affected modules: $MODULE_ERRORS"

  # Check package.json
  cd ${PROJECT_ROOT}/backend/function-apps/api
  if ! grep -q '"dependencies"' package.json; then
    echo "FIX: Add dependencies field to package.json"
    # Apply fix from Root Cause 2 section
  fi
fi
```

### Pattern 3: User Reports "Works Locally, Fails in Azure"

```bash
# This often indicates platform binary mismatch
echo "Checking if deployment was built on macOS..."

# Check current OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Running on macOS"

  # Check if Podman was used
  podman machine list
  if [ $? -ne 0 ]; then
    echo "ROOT CAUSE: Podman not installed on macOS"
    echo "FIX: Install Podman or build on Linux"
  else
    PODMAN_STATUS=$(podman machine list | grep "Currently running")
    if [ -z "$PODMAN_STATUS" ]; then
      echo "ROOT CAUSE: Podman machine not running"
      echo "FIX: Start Podman machine before building"
      # Apply fix from Root Cause 3 section
    fi
  fi
fi
```

---

## Quick Decision Tree for AI Agents

```
START: User reports functions not working

├─ Q: Are functions listed in Azure Portal?
│  └─ Check: az functionapp function list --query "length(@)"
│     ├─ If 0: Go to BRANCH A
│     └─ If >0: Go to BRANCH B

BRANCH A: Functions not discovered
├─ Q: Is AzureWebJobsFeatureFlags set?
│  └─ Check: az functionapp config appsettings list --query "[?name=='AzureWebJobsFeatureFlags']"
│     ├─ If missing: FIX = Set feature flag (Root Cause 1)
│     └─ If present: Go to BRANCH C

BRANCH B: Functions listed but not responding
├─ Q: Does healthcheck return 404?
│  └─ Check: curl https://<app>-<slot>.azurewebsites.us/api/healthcheck
│     ├─ If 404: Check IP restrictions
│     ├─ If 403: IP restrictions blocking
│     └─ If 500: Go to BRANCH C

BRANCH C: Application errors
├─ Q: Do logs show "Cannot find module"?
│  └─ Check: Download logs and grep "cannot find module"
│     ├─ If yes: FIX = Check package.json dependencies (Root Cause 2)
│     └─ If no: Go to BRANCH D

BRANCH D: Platform issues
├─ Q: Do logs show ELF/architecture errors?
│  └─ Check: Download logs and grep "ELF\|architecture"
│     ├─ If yes: FIX = Rebuild with Podman (Root Cause 3)
│     └─ If no: Investigate further with log streaming
```

---

## Key File Locations

### Configuration Files
- `${PROJECT_ROOT}/.nvmrc` - Node version specification
- `${PROJECT_ROOT}/backend/esbuild-shared.mjs` - esbuild external deps list
- `${PROJECT_ROOT}/backend/pack.sh` - Packaging script with OS detection
- `${PROJECT_ROOT}/backend/Dockerfile.build` - Linux build container

### Function App Files
- `${PROJECT_ROOT}/backend/function-apps/api/package.json` - Must have dependencies
- `${PROJECT_ROOT}/backend/function-apps/api/esbuild.config.mjs` - Build config
- `${PROJECT_ROOT}/backend/function-apps/api/index.ts` - Function loader
- `${PROJECT_ROOT}/backend/function-apps/dataflows/package.json` - Must have dependencies

### CI/CD Files
- `${PROJECT_ROOT}/.github/workflows/sub-build.yml` - Build workflow
- `${PROJECT_ROOT}/.github/workflows/sub-deploy-code-slot.yml` - Deploy workflow
- `${PROJECT_ROOT}/ops/scripts/pipeline/slots/az-func-slot-deploy.sh` - Deploy script

---

## Last Updated

January 2026 - Based on successful migration from tsc+tsc-alias to esbuild bundling.
