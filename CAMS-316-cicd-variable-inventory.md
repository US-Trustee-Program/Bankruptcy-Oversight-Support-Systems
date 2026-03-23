# CAMS-316: CI/CD Variable Inventory and Resource Naming Conventions

**Purpose**: Document all variables used in GitHub Actions and Azure DevOps pipelines to support resource cleanup and identify unused variables.

**Date**: 2026-03-23

---

## Executive Summary

This document inventories all CI/CD variables across both deployment systems (GitHub Actions for Flexion, Azure DevOps for USTP) and documents resource naming conventions to support safe cleanup of unused resources.

### Key Findings

1. **Resource Tagging**: Resources are tagged with `app: 'cams'`, `component: <type>`, and `deployed-at: <timestamp>`
2. **Branch Deployments**: Non-main branches get resource groups tagged with `isBranchDeployment`, `branchName`, and `branchHashId`
3. **Naming Pattern**: Resources follow `{stackName}-{component}` pattern where stackName = `APP_NAME[-DEV_SUFFIX][-branchHash]`
4. **Missing Tag Support**: NOT all resources are tagged consistently - some are created without the tagging system

---

## Resource Naming Conventions

### Stack Name Generation

**Algorithm** (from `ops/scripts/pipeline/generate-stackname.sh`):

```bash
# Main branch (production):
stackName = APP_NAME
# Example: "ustp-cams" (GHA) or "ustp-cams-prd" (ADO)

# Feature branches:
stackName = APP_NAME + DEV_SUFFIX + "-" + branchHashId
# Example: "ustp-cams-dev-a1b2c3"
```

**Branch Hash**: First 6 characters of SHA256 hash of branch name

### Resource Naming Patterns

| Resource Type | Naming Pattern | Example (Main) | Example (Branch) |
|---------------|----------------|----------------|------------------|
| **Resource Group** | `{base-name}[-branchHashId]` | `rg-ustp-cams` | `rg-ustp-cams-a1b2c3` |
| **Webapp** | `{stackName}-webapp` | `ustp-cams-webapp` | `ustp-cams-dev-a1b2c3-webapp` |
| **API Function** | `{stackName}-node-api` | `ustp-cams-node-api` | `ustp-cams-dev-a1b2c3-node-api` |
| **Dataflows Function** | `{stackName}-dataflows` | `ustp-cams-dataflows` | `ustp-cams-dev-a1b2c3-dataflows` |
| **App Service Plan (Webapp)** | `plan-{stackName}-webapp` | `plan-ustp-cams-webapp` | `plan-ustp-cams-dev-a1b2c3-webapp` |
| **App Service Plan (API)** | `plan-{stackName}-functions-api` | `plan-ustp-cams-functions-api` | `plan-ustp-cams-dev-a1b2c3-functions-api` |
| **App Service Plan (Dataflows)** | `plan-{stackName}-functions-dataflows` | `plan-ustp-cams-functions-dataflows` | `plan-ustp-cams-dev-a1b2c3-functions-dataflows` |
| **Storage Account (API)** | `st{stackNameNoHyphens}api` | `stustpcamsapi` | `stustpcamsdeva1b2c3api` |
| **Storage Account (Dataflows)** | `st{stackNameNoHyphens}df` | `stustpcamsdf` | `stustpcamsdeva1b2c3df` |
| **Managed Identity (API)** | `id-{apiFunctionName}-user` | `id-ustp-cams-node-api-user` | `id-ustp-cams-dev-a1b2c3-node-api-user` |
| **Managed Identity (Dataflows)** | `id-{dataflowsFunctionName}-user` | `id-ustp-cams-dataflows-user` | `id-ustp-cams-dev-a1b2c3-dataflows-user` |
| **Application Insights (Webapp)** | `appi-{webappName}` | `appi-ustp-cams-webapp` | `appi-ustp-cams-dev-a1b2c3-webapp` |
| **Application Insights (API)** | `appi-{apiFunctionName}` | `appi-ustp-cams-node-api` | `appi-ustp-cams-dev-a1b2c3-node-api` |
| **Application Insights (Dataflows)** | `appi-{dataflowsFunctionName}` | `appi-ustp-cams-dataflows` | `appi-ustp-cams-dev-a1b2c3-dataflows` |
| **Log Analytics Workspace** | `law-{stackName}` | `law-ustp-cams` (shared main) | `law-ustp-cams-dev-a1b2c3` |
| **VNet** | `vnet-{stackName}` | `vnet-ustp-cams` | N/A (shared) |
| **Subnets** | `snet-{resourceName}` | `snet-ustp-cams-webapp` | `snet-ustp-cams-dev-a1b2c3-webapp` |
| **Key Vault** | `kv-{stackName}` | `kv-ustp-cams` | N/A (shared) |
| **Cosmos DB Account** | `cosmos-ustp-cams-{env}` | `cosmos-ustp-cams-prd` | N/A (shared) |
| **Cosmos Database** | `cams` | `cams` | N/A (shared main database) |
| **Cosmos E2E Database** | `cams-e2e[-branchHashId]` | `cams-e2e` | `cams-e2e-a1b2c3` |

### Resource Tagging Strategy

**Standard Tags** (applied to most resources via `main.bicep`):

```bicep
var webappTags = {
  app: 'cams'
  component: 'webapp'
  'deployed-at': deployedAt  // UTC timestamp
}

var apiTags = {
  app: 'cams'
  component: 'api'
  'deployed-at': deployedAt
}

var dataflowsTags = {
  app: 'cams'
  component: 'dataflows'
  'deployed-at': deployedAt
}
```

**Branch Deployment Tags** (applied to Resource Groups via `ustp-cams-rg.bicep`):

```bicep
tags: {
  isBranchDeployment: true
  branchName: "CAMS-123-feature-name"
  branchHashId: "a1b2c3"
}
```

**Components with Tags**:
- ✅ Webapp (production slot)
- ✅ Webapp (staging slot) - adds `{ slot: 'deployment' }`
- ✅ API Function App (production slot)
- ✅ API Function App (staging slot) - adds `{ slot: 'deployment' }`
- ✅ Dataflows Function App (production slot)
- ✅ Dataflows Function App (staging slot) - adds `{ slot: 'deployment' }`
- ✅ App Service Plans
- ✅ Application Insights
- ✅ Storage Accounts
- ✅ Managed Identities
- ✅ Resource Groups (branch deployments only)
- ✅ Security Scan Storage (`component: 'security-scan'`)
- ✅ Key Vault (`component: 'security'`)
- ✅ Cosmos DB Account (`component: 'cosmos'`)
- ✅ Log Analytics Workspace (`component: 'analytics'`)

**Resources WITHOUT Comprehensive Tags**:
- ❌ VNets (may be shared/existing)
- ❌ Subnets (part of VNet)
- ❌ Private Endpoints
- ❌ DNS Zones (may be shared)
- ❌ SQL Server resources (existing/external)

---

## GitHub Actions Variables

### Organization

GitHub Actions variables are organized in **GitHub Environments**:
- `Main-Gov` - Production (main branch only)
- `Develop` - Development branches

Variables are accessed via:
- `vars.VARIABLE_NAME` - Environment variables
- `secrets.SECRET_NAME` - Encrypted secrets

### Complete Variable Inventory

#### Common Variables

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `NODE_VERSION` | Variable | Environment | All test/build jobs | Node.js version (22.17.1) |
| `APP_NAME` | Variable | Environment | `reusable-build-info.yml` | Base application name |
| `DEV_SUFFIX` | Variable | Environment (Develop only) | `reusable-build-info.yml` | Suffix for dev branches (e.g., "-dev") |

#### Build & Deployment Variables

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `CAMS_SERVER_PORT` | Variable | Environment | `sub-build.yml` | Server port (443) |
| `CAMS_SERVER_PROTOCOL` | Variable | Environment | `sub-build.yml` | Protocol (HTTPS) |
| `CAMS_BASE_PATH` | Variable | Environment | `sub-build.yml` | API base path (/api) |
| `CAMS_LAUNCH_DARKLY_ENV` | Variable | Environment | `sub-build.yml`, `reusable-infrastructure-deploy.yml` | LaunchDarkly environment identifier |
| `CAMS_LOGIN_PROVIDER` | Variable | Environment | `reusable-infrastructure-deploy.yml` | Login provider (mock/okta/none) |
| `CAMS_LOGIN_PROVIDER_CONFIG` | Variable | Environment | `reusable-infrastructure-deploy.yml` | JSON config for auth provider |
| `SLOT_NAME` | Variable | Environment | `reusable-build-info.yml` | Deployment slot name (staging) |

#### Azure Configuration

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `AZURE_ENVIRONMENT` | Variable | Environment | All Azure jobs | Target Azure cloud (AzureUSGovernment/AzureCloud) |
| `AZ_PLAN_TYPE` | Variable | Environment | `reusable-infrastructure-deploy.yml` | App Service plan SKU (P1v2/B2/S1) |
| `AZ_LOCATION` | Secret | Environment | Infrastructure deployment | Azure region |

#### Azure Resource Groups

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `AZ_APP_RG` | Secret | Environment | `reusable-build-info.yml` | Application resource group |
| `AZ_NETWORK_RG` | Secret | Environment | Infrastructure deployment | Network resource group |
| `AZURE_RG` | Secret | Environment | Infrastructure deployment | Miscellaneous resources RG |
| `AZ_ANALYTICS_RG` | Secret | Environment | Infrastructure deployment | Analytics/monitoring RG |

#### Azure Networking

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `AZ_NETWORK_VNET_NAME` | Variable | Environment | `reusable-infrastructure-deploy.yml` | Virtual network name |

#### Azure Authentication

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `AZURE_CREDENTIALS` | Secret | Environment | All Azure login steps | Service principal credentials (JSON) |
| `AZURE_SUBSCRIPTION` | Secret | Environment | Infrastructure deployment | Azure subscription ID |
| `PGP_SIGNING_PASSPHRASE` | Secret | Environment | `reusable-build-info.yml` | Used to encrypt RG names between jobs |

#### Key Vault & Secrets

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `AZ_KV_APP_CONFIG_NAME` | Secret | Environment | Infrastructure deployment | Key Vault name |
| `AZ_KV_APP_CONFIG_MANAGED_ID` | Secret | Environment | Infrastructure deployment | Managed Identity for KV access |
| `AZ_KV_APP_CONFIG_RG_NAME` | Secret | Environment | Supporting infrastructure | Key Vault resource group |

#### Database Configuration

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `AZ_COSMOS_DATABASE_NAME` | Secret | Environment | Infrastructure deployment | Cosmos DB database name |
| `AZ_COSMOS_MONGO_ACCOUNT_NAME` | Secret | Environment | Supporting infrastructure | Cosmos MongoDB account name |
| `AZ_SQL_SERVER_NAME` | Secret | Environment | Infrastructure deployment | SQL Server name (existing) |
| `AZ_SQL_IDENTITY_NAME` | Secret | Environment | Infrastructure deployment | SQL Server managed identity |

#### Monitoring & Alerting

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `AZ_ANALYTICS_WORKSPACE_ID` | Secret | Environment | Infrastructure deployment | Log Analytics workspace ID |
| `AZ_ANALYTICS_WORKSPACE_NAME` | Secret | Environment | Supporting infrastructure | Log Analytics workspace name |
| `AZ_ACTION_GROUP_NAME` | Secret | Environment | Infrastructure deployment | Alert action group name |
| `CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING` | Secret | Environment | Build (via bicep output) | App Insights connection |

#### Application Configuration

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `OKTA_URL` | Variable | Environment | Infrastructure deployment | Okta provider URL |
| `USTP_ISSUE_COLLECTOR_HASH` | Secret | Environment | Infrastructure deployment | CSP policy hash |
| `MSSQL_REQUEST_TIMEOUT` | Variable | Environment | Infrastructure deployment | SQL timeout value |
| `CAMS_ENABLED_DATAFLOWS` | Variable | Environment | Infrastructure deployment | Comma-separated dataflow list |
| `MAX_OBJECT_DEPTH` | Variable | Environment | Infrastructure deployment | JSON parsing limit |
| `MAX_OBJECT_KEY_COUNT` | Variable | Environment | Infrastructure deployment | JSON parsing limit |

#### Feature Flags

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `CAMS_FEATURE_FLAG_CLIENT_ID` | Secret | Environment | Build (frontend) | LaunchDarkly client ID |

#### Security Scanning (Snyk)

| Name | Type | Source | Used In | Description |
|------|------|--------|---------|-------------|
| `AZ_SECURITY_SCAN_RG` | Secret | Environment | `deploy-security-scan-storage.yml` | Security scan storage RG |
| `AZ_SECURITY_SCAN_STORAGE_NAME` | Secret | Environment | `deploy-security-scan-storage.yml` | Storage account for scan results |
| `SNYK_OAUTH_CLIENT_ID` | Secret | Environment | Security scan workflow | Snyk OAuth client ID |
| `SNYK_OAUTH_CLIENT_SECRET` | Secret | Environment | Security scan workflow | Snyk OAuth secret |

---

## Azure DevOps Variables

### Organization

Azure DevOps variables are organized in **Variable Groups** (Libraries):
- `CAMS-STG` - Staging environment
- `CAMS-PRD` - Production environment (implied)

Variables are accessed via:
- `$(VARIABLE_NAME)` - Standard variables

### Complete Variable Inventory

#### Repository & Build

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `REPO_DIR` | `cams` | All stages | Working directory name for cloned repo |
| `REPO_BRANCH` | `main` | Clone steps | Branch to clone |
| `NODE_API_VERSION` | `18.17.1` | Build stages | Node.js version (⚠️ Note: Different from GHA) |

#### Application Configuration

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `FULL_APP_NAME` | `ustp-cams-prd` | Most stages | Full stack name (becomes stackName param) |
| `RESOURCE_GROUP` | `rg-ustp-cams-prd` | All deployment stages | Primary resource group |

#### Azure Networking

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `USTP_VIRTUAL_NETWORK` | `VNet.VA` | Bicep deployment | Existing VNet name |
| `USTP_VNET_RESOURCE_GROUP` | `Network` | Bicep deployment | VNet resource group |
| `PRIVATE_ENDPOINT_DNS_ZONE_NAME` | `privatelink.azurewebsites.us` | Bicep deployment | Private DNS zone |
| `PRIVATE_DNS_SUBSCRIPTION` | `<GUID>` | Bicep deployment | DNS zone subscription ID |
| `AZ_PEP_SNET_NAME` | `VNet.VA.SUB-PE` | Bicep deployment | Private endpoint subnet |
| `AZ_PEP_SNET_ADDRESS` | `10.10.12.0/28` | Bicep deployment | PE subnet CIDR |
| `AZ_SNET_API_SUBNET` | `VNet.VA.ENV-function-api` | Bicep deployment | API function subnet |
| `AZ_SNET_API_SUBNET_ADDRESS` | `10.10.11.0/28` | Bicep deployment | API subnet CIDR |
| `AZ_SNET_WEB_SUBNET` | `VNet.VA.ENV-webapp-snet` | Bicep deployment | Webapp subnet |
| `AZ_SNET_WEB_SUBNET_ADDRESS` | `10.10.10.0/28` | Bicep deployment | Webapp subnet CIDR |
| `AZ_SNET_DATAFLOWS_SUBNET` | `VNet.VA.ENV-dataflows-snet` | Bicep deployment | Dataflows subnet |
| `AZ_SNET_DATAFLOWS_SUBNET_ADDRESS` | `10.10.13.0/28` | Bicep deployment | Dataflows subnet CIDR |

#### Key Vault & Secrets

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `AZ_KV_APP_CONFIG_NAME` | `kv-ustp-cams-prd` | Bicep deployment | Key Vault name |
| `AZ_KV_APP_CONFIG_MANAGED_ID` | `id-kv-app-config-<hash>` | Bicep deployment | KV managed identity |
| `AZ_KV_APP_CONFIG_RESOURCE_GROUP` | `test22` | Bicep deployment | KV resource group |

#### Database Configuration

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `AZ_COSMOS_ACCOUNT_NAME` | `cosmos-ustp-cams-tst` | Bicep deployment | Cosmos account name |
| `AZ_COSMOS_DATABASE_NAME` | `cams` | Bicep deployment | Database name |
| `AZ_COSMOS_DATABASE_ID_NAME` | `id-cosmos-ustp-cams-tst-user` | Bicep deployment | Cosmos managed identity |
| `AZ_COSMOS_DB_CLIENT_ID` | `<GUID>` | Cosmos deployment | Managed identity client ID |
| `AZ_COSMOS_DB_PRINCIPAL_ID` | `<GUID>` | Cosmos deployment | Managed identity principal ID |
| `AZ_SQL_SERVER_NAME` | `<FQDN>` | Bicep deployment | SQL Server host (existing) |
| `AZ_SQL_RESOURCE_GROUP` | `SQL` | Bicep deployment | SQL resource group |
| `AZ_SQL_SUBSCRIPTION_ID` | `<GUID>` | Bicep deployment | SQL subscription ID |
| `MSSQL_DATABASE_DXTR` | `AODATEX_TST` | Runtime config | DXTR database name |

#### Monitoring & Alerting

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `AZ_ANALYTICS_RG` | `Monitoring` | Bicep deployment | Analytics resource group |
| `AZ_ANALYTICS_WORKSPACE_ID` | `<RESOURCE_ID>` | Bicep deployment | Log Analytics ID |
| `AZ_ACTION_GROUP_NAME` | `<name>` | Bicep deployment | Alert action group |

#### Frontend Build Variables

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `CAMS_INFO_SHA` | `<git SHA>` | Build (set by pipeline) | Git commit SHA |
| `CAMS_LAUNCH_DARKLY_ENV` | `staging`/`production` | Build | LaunchDarkly env |
| `CAMS_SERVER_HOSTNAME` | `ustp-cams-prd-node-api.azurewebsites.us` | Build (production) | API hostname |
| `CAMS_STAGING_SLOT_HOSTNAME` | `ustp-cams-prd-node-api-staging.azurewebsites.us` | Build (staging slot) | Staging API hostname |
| `CAMS_BASE_PATH` | `/api` | Build | API base path |
| `CAMS_SERVER_PORT` | `443` | Build | Server port |
| `CAMS_SERVER_PROTOCOL` | `HTTPS` | Build | Protocol |
| `CAMS_LOGIN_PROVIDER` | `okta` | Build | Auth provider |
| `CAMS_LOGIN_PROVIDER_CONFIG` | `<JSON>` | Build | Auth config (no spaces) |
| `CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING` | `<connection string>` | Build | App Insights |
| `CAMS_FEATURE_FLAG_CLIENT_ID` | `<token>` | Build | LaunchDarkly client ID |
| `OKTA_URL` | `<URL>` | Bicep deployment | Okta provider URL |

#### Deployment Slot Configuration

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `USTP_SLOT_NAME` | `staging` | All slot operations | Deployment slot name |
| `USTP_SLOT_API_STORAGE_NAME` | `camsstoragestaging` | Slot deployment | Storage account (⚠️ must be unique) |

#### Application Settings

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `STARTING_MONTH` | `72` | Backend runtime | Case filtering (months back) |
| `CAMS_ENABLED_DATAFLOWS` | `orders-sync,case-sync` | Dataflows runtime | Enabled dataflows (comma-separated) |
| `USTP_ISSUE_COLLECTOR_HASH` | `<SHA>` | CSP policy | Jira collector hash |
| `REACT_SELECT_HASH` | `<SHA>` | CSP policy | React Select library hash |
| `MAX_OBJECT_DEPTH` | `32` | Runtime | JSON parsing limit |
| `MAX_OBJECT_KEY_COUNT` | `1000` | Runtime | JSON parsing limit |
| `MSSQL_REQUEST_TIMEOUT` | `300000` | Runtime | SQL timeout (ms) |

#### CI/CD Pipeline Control

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `CI` | `true` | Unit tests | Flag for CI environment |
| `NODE_EXTRA_CA_CERTS` | `/etc/ssl/certs/ca-certificates.crt` | Build | Custom CA certificates |

#### Azure Subscriptions

| Name | Value Example | Used In | Description |
|------|---------------|---------|-------------|
| `AZ_APP_SUBSCRIPTION_ID` | `<GUID>` | Deployment | App resources subscription |

---

## Variable Comparison: GitHub Actions vs Azure DevOps

### Identical Purpose (Different Names/Sources)

| GitHub Actions | Azure DevOps | Purpose |
|----------------|--------------|---------|
| `vars.APP_NAME` + branch logic | `FULL_APP_NAME` | Stack name generation |
| `secrets.AZ_APP_RG` + hash suffix | `RESOURCE_GROUP` | App resource group |
| `vars.NODE_VERSION` | `NODE_API_VERSION` | Node.js version (⚠️ **DIFFERENT VALUES**) |
| `vars.SLOT_NAME` | `USTP_SLOT_NAME` | Deployment slot name |
| Dynamic (via git) | `REPO_BRANCH` | Branch to deploy |
| Checkout path | `REPO_DIR` | Working directory |

### GitHub Actions Only

| Variable | Reason |
|----------|--------|
| `DEV_SUFFIX` | Flexion-specific branch naming |
| `AZURE_ENVIRONMENT` | Flexion uses AzureCloud, USTP is hardcoded to AzureUSGovernment |
| `PGP_SIGNING_PASSPHRASE` | GHA-specific secret passing between jobs |

### Azure DevOps Only

| Variable | Reason |
|----------|--------|
| `CI` | ADO sets this for unit tests |
| `NODE_EXTRA_CA_CERTS` | USTP network certificates |
| `REACT_SELECT_HASH` | USTP CSP policy |
| `USTP_SLOT_API_STORAGE_NAME` | Slot-specific storage override |
| `AZ_COSMOS_DB_CLIENT_ID` / `AZ_COSMOS_DB_PRINCIPAL_ID` | Manual Cosmos identity tracking |
| `AZ_SQL_SUBSCRIPTION_ID` | Cross-subscription SQL access |
| Explicit subnet CIDRs | Existing USTP network constraints |

### Shared (Same Name, Used in Both)

| Variable | Notes |
|----------|-------|
| `CAMS_SERVER_PORT` | Always 443 |
| `CAMS_SERVER_PROTOCOL` | Always HTTPS |
| `CAMS_BASE_PATH` | Always /api |
| `CAMS_LAUNCH_DARKLY_ENV` | Environment-specific |
| `CAMS_LOGIN_PROVIDER` | `mock` (Flexion) or `okta` (USTP) |
| `CAMS_LOGIN_PROVIDER_CONFIG` | JSON config |
| `CAMS_ENABLED_DATAFLOWS` | Comma-separated list |
| `OKTA_URL` | Okta provider URL |
| `USTP_ISSUE_COLLECTOR_HASH` | CSP policy hash |
| `MAX_OBJECT_DEPTH` | Runtime limit |
| `MAX_OBJECT_KEY_COUNT` | Runtime limit |
| `MSSQL_REQUEST_TIMEOUT` | Timeout value |

---

## Identifying Resources for Cleanup

### Safe Cleanup Criteria

Use this decision tree to determine if a resource can be safely deleted:

#### 1. Check Resource Group Tags (Branch Deployments)

**Query**:
```bash
az group list --query "[?tags.isBranchDeployment=='true']" -o table
```

**Safe to delete if**:
- `tags.isBranchDeployment` = `true`
- `tags.branchName` corresponds to a deleted/merged branch
- No active PR or work for that branch

#### 2. Check Resource Naming Pattern

**Resources matching these patterns are branch deployments**:

```
{APP_NAME}{DEV_SUFFIX}-{6-char-hash}-*
```

Examples:
- `ustp-cams-dev-a1b2c3-webapp`
- `ustp-cams-dev-a1b2c3-node-api`
- `rg-ustp-cams-dev-a1b2c3`
- `law-ustp-cams-dev-a1b2c3`

**Verification**:
1. Extract the 6-character hash
2. Check if corresponding branch exists:
   ```bash
   # Find branches whose SHA256 hash starts with the extracted hash
   git branch -r | while read branch; do
     branchName=$(echo $branch | sed 's/origin\///')
     hash=$(echo -n "$branchName" | openssl sha256 | awk '{print $2}' | cut -c1-6)
     if [ "$hash" = "a1b2c3" ]; then
       echo "Found: $branchName"
     fi
   done
   ```
3. If no matching branch exists, resource is orphaned

#### 3. Check Cosmos E2E Databases

**Pattern**: `cams-e2e-{branchHashId}`

**Query**:
```bash
az cosmosdb mongodb database list \
  --account-name cosmos-ustp-cams-prd \
  --resource-group <RG> \
  --query "[?starts_with(id, '/subscriptions/*/resourceGroups/*/providers/Microsoft.DocumentDB/databaseAccounts/*/mongodbDatabases/cams-e2e-')]"
```

**Safe to delete if**:
- Database name ends with 6-char hash
- No corresponding branch exists
- Not `cams-e2e` (main E2E database)

#### 4. Check Log Analytics Workspaces

**Pattern**: `law-{stackName}`

Branch workspaces have the branch hash in the stack name.

**Query**:
```bash
az monitor log-analytics workspace list \
  --resource-group <ANALYTICS_RG> \
  --query "[?contains(name, '-')]" -o table
```

**Safe to delete if**:
- Name contains a 6-char hash
- No corresponding branch exists
- Not the shared main workspace

### Resources That Should NEVER Be Deleted

**Shared Infrastructure** (not tagged, managed separately):
- Main production resource groups (`rg-ustp-cams-prd`, `rg-ustp-cams-stg`)
- VNets and subnets (shared across deployments)
- Private DNS zones (shared)
- Key Vaults (contain secrets for multiple environments)
- Cosmos DB accounts (contain multiple databases)
- SQL Server instances (external/existing)
- Action Groups (monitoring)
- Main Log Analytics Workspace (shared)

**Main Branch Resources**:
- Resources where `stackName = APP_NAME` (no suffix, no hash)
- `ustp-cams-webapp`, `ustp-cams-node-api`, `ustp-cams-dataflows`
- `cams` database, `cams-e2e` database (no hash suffix)

### Cleanup Script Template

```bash
#!/usr/bin/env bash
# CAMS-316: Branch Resource Cleanup Script

set -euo pipefail

# Configuration
ANALYTICS_RG="<ANALYTICS_RG>"
APP_RG_PREFIX="<APP_RG_PREFIX>"
COSMOS_ACCOUNT="<COSMOS_ACCOUNT>"
COSMOS_RG="<COSMOS_RG>"

# Get all local and remote branches
echo "Fetching all branches..."
git fetch --all --prune
ALL_BRANCHES=$(git branch -a | sed 's/^\*\?[ \t]*//' | sed 's/remotes\/origin\///' | sort -u)

# Generate hashes for all branches
declare -A BRANCH_HASHES
while IFS= read -r branch; do
  if [[ -n "$branch" && "$branch" != "HEAD" ]]; then
    hash=$(echo -n "$branch" | openssl sha256 | awk '{print $2}' | cut -c1-6)
    BRANCH_HASHES[$hash]=$branch
  fi
done <<< "$ALL_BRANCHES"

echo "Found ${#BRANCH_HASHES[@]} active branches"

# Function to check if hash is active
is_active_branch() {
  local hash=$1
  [[ -n "${BRANCH_HASHES[$hash]:-}" ]]
}

# 1. Find orphaned Resource Groups
echo "Checking Resource Groups..."
az group list --query "[?tags.isBranchDeployment=='true'].{name:name, branch:tags.branchName, hash:tags.branchHashId}" -o json | \
  jq -r '.[] | "\(.hash)\t\(.name)\t\(.branch)"' | \
  while IFS=$'\t' read -r hash name branch; do
    if ! is_active_branch "$hash"; then
      echo "ORPHANED RG: $name (branch: $branch, hash: $hash)"
      # Uncomment to delete:
      # az group delete --name "$name" --yes --no-wait
    fi
  done

# 2. Find orphaned Log Analytics Workspaces
echo "Checking Log Analytics Workspaces..."
az monitor log-analytics workspace list \
  --resource-group "$ANALYTICS_RG" \
  --query "[?contains(name, '-')].name" -o tsv | \
  while read -r workspace; do
    # Extract potential hash from name (last 6 chars before any extension)
    hash=$(echo "$workspace" | grep -oE '[a-f0-9]{6}' | tail -1)
    if [[ -n "$hash" ]] && ! is_active_branch "$hash"; then
      echo "ORPHANED LAW: $workspace (hash: $hash)"
      # Uncomment to delete:
      # az monitor log-analytics workspace delete --resource-group "$ANALYTICS_RG" --workspace-name "$workspace" --yes --no-wait
    fi
  done

# 3. Find orphaned Cosmos E2E databases
echo "Checking Cosmos E2E Databases..."
az cosmosdb mongodb database list \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$COSMOS_RG" \
  --query "[?starts_with(name, 'cams-e2e-')].name" -o tsv | \
  while read -r dbname; do
    # Extract hash from database name
    hash=$(echo "$dbname" | sed 's/cams-e2e-//')
    if [[ "$hash" =~ ^[a-f0-9]{6}$ ]] && ! is_active_branch "$hash"; then
      echo "ORPHANED DB: $dbname (hash: $hash)"
      # Uncomment to delete:
      # az cosmosdb mongodb database delete --account-name "$COSMOS_ACCOUNT" --resource-group "$COSMOS_RG" --name "$dbname" --yes
    fi
  done

echo "Cleanup analysis complete. Review output and uncomment delete commands to proceed."
```

---

## Recommendations

### 1. Improve Resource Tagging

**Problem**: Not all resources are consistently tagged, making automated cleanup difficult.

**Solution**: Enhance `main.bicep` and supporting templates to add tags to ALL resources:

```bicep
// Add to all resource deployments
param baseTags object = {
  app: 'cams'
  'deployed-at': utcNow()
  stackName: stackName
  environment: contains(stackName, '-') ? 'branch' : 'main'
  gitSha: gitSha
}

// Merge with component-specific tags
tags: union(baseTags, componentTags)
```

### 2. Automate Branch Cleanup

**Create a scheduled GitHub Action** to identify and report orphaned resources:

```yaml
name: Resource Cleanup Report
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  cleanup-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run cleanup analysis
        run: ./ops/scripts/cleanup-orphaned-resources.sh --dry-run
```

### 3. Document Variable Dependencies

**Create a variable dependency map** showing which Bicep parameters require which CI/CD variables.

### 4. Consolidate Documentation

**Current state**: Variables documented in multiple places
- `docs/operations/deployment.md` (incomplete)
- `.ado-mirror/ADO_VAR_GRP.md` (USTP only)
- Comments in workflow files

**Recommendation**: Create single source of truth at `docs/operations/cicd-variables.md`

### 5. Add Variable Validation

**Add validation scripts** to CI/CD pipelines to check for missing or misconfigured variables before deployment.

---

## Appendix: Key Vault Secrets

These secrets are stored in Azure Key Vault (not in CI/CD variables):

| Secret Name | Description |
|-------------|-------------|
| `ACMS-MSSQL-DATABASE` | ACMS database name |
| `ACMS-MSSQL-HOST` | ACMS SQL host |
| `ACMS-MSSQL-USER` | ACMS SQL user |
| `ACMS-MSSQL-PASS` | ACMS SQL password |
| `ACMS-MSSQL-ENCRYPT` | ACMS connection encryption flag |
| `ACMS-MSSQL-TRUST-UNSIGNED-CERT` | ACMS cert validation flag |
| `ADMIN-KEY` | API admin key |
| `CAMS-USER-GROUP-GATEWAY-CONFIG` | IDP group API config |
| `FEATURE-FLAG-SDK-KEY` | LaunchDarkly SDK key |
| `MONGO-CONNECTION-STRING` | Cosmos DB connection string |
| `MSSQL-DATABASE-DXTR` | DXTR database name |
| `MSSQL-HOST` | DXTR SQL host |
| `MSSQL-USER` | DXTR SQL user |
| `MSSQL-PASS` | DXTR SQL password |
| `MSSQL-ENCRYPT` | DXTR connection encryption flag |
| `MSSQL-TRUST-UNSIGNED-CERT` | DXTR cert validation flag |

---

## Questions for Further Investigation

1. **NODE_VERSION discrepancy**: GHA uses 22.17.1, ADO uses 18.17.1 - is this intentional?
2. **test22 resource group**: ADO_VAR_GRP.md references `test22` as Key Vault RG - is this still in use?
3. **BOSS references**: Issue description mentions "Get rid of BOSS" - what is BOSS and what resources does it have?
4. **Slot storage accounts**: ADO has `USTP_SLOT_API_STORAGE_NAME` but GHA doesn't - why the difference?
5. **Missing tags**: Should we retrofit tagging onto existing VNets, subnets, and shared resources?
