# Deployment

## USTP vs Flexion Environment Differences

CAMS is deployed to two distinct environment types with different requirements:

- **Flexion Environments**: Development and testing environments managed by Flexion, deployed via GitHub Actions workflows
- **USTP Environments**: Production and staging environments managed by USTP, deployed via Azure DevOps pipelines

### Deployment Pipelines

| Environment | Tool | Location |
|------------|------|----------|
| Flexion | GitHub Actions | `.github/workflows/` in CAMS repo |
| USTP | Azure DevOps | `ADO-Mirror` repository |

Both pipelines use the same Infrastructure as Code (Bicep templates) and shell scripts to ensure deployed environments are as similar as possible, with differences limited to security and access policies.

### Network Security and Firewall Rules

The most significant difference between environments is network access control:

| Resource | Slot | USTP | Flexion |
|----------|------|------|---------|
| Webapp | Production | Deny-by-default + explicit allow rules | Publicly accessible (Allow all) |
| Webapp | Staging | Deny-by-default + explicit allow rules | Deny-by-default |
| API Function App | Production | Deny-by-default + explicit allow rules | Publicly accessible (Allow all) |
| API Function App | Staging | Deny-by-default + explicit allow rules | Deny-by-default |
| Dataflows Function App | Production | Deny-by-default + explicit allow rules | Deny-by-default + explicit allow rules |
| Dataflows Function App | Staging | Deny-by-default + explicit allow rules | Deny-by-default |

**Key Principles:**
- **USTP**: All resources are deny-by-default with explicit allow rules for authorized access only
- **Flexion**: Production webapp and API function are publicly accessible to facilitate testing and demos
- **Dataflows**: Always deny-by-default in both environments (internal-only service)

### The `isUstpDeployment` Flag

The `isUstpDeployment` parameter/flag is used throughout the deployment tooling to toggle environment-specific behavior:

**Bicep Templates** (`ops/cloud-deployment/*.bicep`):
- `isUstpDeployment` parameter determines firewall rules in Infrastructure as Code
- Example: `action: isUstpDeployment ? 'Deny' : 'Allow'`

**Shell Scripts** (`ops/scripts/pipeline/*.sh`):
- Scripts accept `--isUstpDeployment` flag to handle environment-specific logic
- Used in: `endpoint-test.sh`, `dev-add-allowed-ip.sh`, `dev-rm-allowed-ip.sh`
- Example: ADO pipelines pass `--isUstpDeployment`, GHA workflows do not

**Important**: When adding scripts that modify firewall rules, always check if behavior should differ between USTP and Flexion environments.

### Post-Swap Firewall Handling

Azure slot swaps exchange all slot settings, including firewall configurations. This requires post-swap correction:

**What happens during swap:**
1. Staging slot code (with Deny firewall) → Production slot
2. Production slot code (with Allow firewall for Flexion) → Staging slot

**Post-swap corrections** (GHA `enable-access` job in `sub-deploy-code-slot.yml`):
- **Webapp production**: Add AllowAll rule (Flexion only)
- **API production**: Add AllowAll rule (Flexion only)
- **Dataflows production**: Keep deny-by-default (both environments)
- **All staging slots**: Set to deny-by-default (both environments)

### Common Gotchas

1. **Dataflows is different**: Dataflows function app is always deny-by-default, even in Flexion production. Don't include it in scripts that add public Allow rules.

2. **Production ≠ Publicly accessible**: In USTP, production slots are deny-by-default. The term "production" refers to the main slot, not accessibility.

3. **Scripts need environment awareness**: When writing scripts that modify access restrictions, use the `--isUstpDeployment` flag if behavior differs between environments.

4. **Test both pipeline types**: Changes to deployment scripts should be validated in both GHA (Flexion) and ADO (USTP) pipelines.

## Infrastructure as Code

Bicep files to provision resources in the Azure cloud environment with support for both commercial and US gov regions located in the ops/cloud-deployment folder. The bicep files are broken down to deploy a subset of what is needed by USTP Case Management System (CAMS). Use the **main bicep**, _main.bicep_, to provision complete Azure resources.

Note the following assumptions:

- Account used to execute bicep code has the necessary permission to provision all resources.
- Prior to running the _main.bicep_ file, the _ustp-cams-kv-app-config-setup.bicep_ file must be run first with the **deployNetworkConfig** param set to false
- After running the _main.bicep_ file, the _ustp-cams-kv-app-config-setup.bicep_ file must be run first with the **deployNetworkConfig** param set to **true**

## CI/CD Pipeline Runtime Variables

?> Note required environment variables and secrets defined in build tool for pipeline execution in Flexion and **shared** with USTP.

### Common

| Name       | Type (Secret/Variable) | Is Flexion Only? | Description                                                                    |
| ---------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------ |
| APP_NAME   | Variable               |                  | Name used to label resource stack in Azure.                                    |
| DEV_SUFFIX | Variable               | Yes              | Suffix added to label resource stack in Azure for non-main branch deployments. |

### Frontend

| Name                                       | Type (Secret/Variable) | Is Flexion Only? | Description                                                           |
| ------------------------------------------ | ---------------------- | ---------------- | --------------------------------------------------------------------- |
| CAMS_SERVER_HOSTNAME                       | Variable               | ---              | Required for frontend build step.                                     |
| CAMS_BASE_PATH                             | Variable               | ---              | Required for frontend build step.                                     |
| CAMS_SERVER_PORT                           | Variable               | ---              | Required for frontend build step.                                     |
| CAMS_SERVER_PROTOCOL                       | Variable               | ---              | Required for frontend build step.                                     |
| CAMS_LAUNCH_DARKLY_ENV                     | Variable               | ---              | Optional environment indicator for deployed environment               |
| CAMS_INFO_SHA                              | Variable               | ---              | Required for frontend build step. Current commit sha of source        |
| CAMS_LOGIN_PROVIDER_CONFIG                 | Variable               | ---              | json config for authentication provider, (no spaces)                  |
| CAMS_LOGIN_PROVIDER                        | Variable               | ---              | Login Provider var (mock, okta, none)                                 |
| CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING | Secret                 | ---              | Optional for log ingestion to Azure Log Analytics.                    |
| CAMS_FEATURE_FLAG_CLIENT_ID                | Secret                 | ---              | Optional client id to enable LaunchDarkly. (LD_DEVELOPMENT_CLIENT_ID) |
| OKTA_URL                                   | Variable               | ---              | Url for Okta, used within bicep deployment for nginx conf             |

### Azure

| Name                         | Type (Secret/Variable) | Is Flexion Only? | Description                                                                                       |
| ---------------------------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| AZURE_SUBSCRIPTION           | Secret                 | ---              | Azure Subscription ID                                                                             |
| AZURE_CREDENTIALS            | Secret                 | ---              | Credentials for Azure Cloud Environment                                                           |
| AZURE_ENVIRONMENT            | Variable               | Yes              | Specify target Azure cloud environment.                                                           |
| AZ_APP_RG                    | Secret                 | ---              | Resource group name for all application related infrastructure.                                   |
| AZURE_RG                     | Secret                 | ---              | Resource group for miscellanous Azure resources                                                   |
| AZ_PLAN_TYPE                 | Variable               | ---              | Determine plan type for Azure App Service plans.                                                  |
| AZ_ACTION_GROUP_NAME         | Secret                 | ---              | Action Group Name for Azure Alerts                                                                |
| AZ_PRIVATE_DNS_ZONE          | Variable               | ---              | Private DNS Zone name                                                                             |
| AZ_PRIVATE_DNS_ZONE_RG       | Secrets                | ---              | Private DNS Zone Azure resource group name                                                        |
| AZ_PRIVATE_DNS_ZONE_ID       | Secrets                | ---              | Private DNS Zone Azure Fully qualified ID                                                         |
| AZ_NETWORK_RG                | Secrets                | ---              | Resource Group for networking components                                                          |
| AZ_NETWORK_VNET_NAME         | Variables              | ---              | Virtual Network Name                                                                              |
| AZ_SQL_SERVER_NAME           | Secret                 | ---              | ---                                                                                               |
| AZ_SQL_IDENTITY_NAME         | Secret                 | ---              | Name of Azure managed identity with access to SQL Server database. Required if not using SQL Auth |
| AZ_COSMOS_DATABASE_NAME      | Secret                 | ---              | ---                                                                                               |
| AZ_COSMOS_MONGO_ACCOUNT_NAME | Secret                 | ---              | ---                                                                                               |
| AZ_COSMOS_ID_NAME            | Secret                 | ---              | Name of Managed Identity accessing cosmos                                                         |
| AZ_ANALYTICS_WORKSPACE_ID    | Secrets                | ---              | Azure resource id of Log Analytics.                                                               |
| AZ_ACTION_GROUP_NAME         | Secrets                | Yes              | Action Group Name for alert rules                                                                 |

### Veracode

| Name                  | Type (Secret/Variable) | Is Flexion Only? | Description                                        |
| --------------------- | ---------------------- | ---------------- | -------------------------------------------------- |
| VERACODE_APP_ID       | Secrets                | Yes              | Reference application identifier for scan results. |
| VERACODE_API_ID       | Secrets                | Yes              | ---                                                |
| VERACODE_API_KEY      | Secrets                | Yes              | ---                                                |
| SRCCLR_API_TOKEN      | Secrets                | Yes              | API Token for Static Code Analysis                 |
| SRCCLR_REGION         | Secrets                | Yes              | Region for Static Code analysis                    |
| AZ_STOR_VERACODE_NAME | Secrets                | Yes              | Azure Storage account name for veracode scans      |
| AZ_STOR_VERACODE_KEY  | Secrets                | Yes              | Access key for Azure Storage account               |
| VERACODE_SAST_POLICY  | Secrets                | ---              | Policy name used for veracode scans                |

### LaunchDarkly

| Name                     | Type (Secret/Variable) | Is Flexion Only? | Description                            |
| ------------------------ | ---------------------- | ---------------- | -------------------------------------- |
| LD_DEVELOPMENT_CLIENT_ID | Secrets                | ---              | Client ID for LaunchDarkly Environment |

### API Function App

| Name                       | Type (Secret/Variable) | Is Flexion Only? | Description                                            |
| -------------------------- | ---------------------- | ---------------- | ------------------------------------------------------ |
| STARTING_MONTH             | Variable               | ---              | Used by application for filtering cases by date range. |
| USTP_ISSUE_COLLECTOR_HASH  | Secrets                | ---              | USTP Only parameter used for CSP policy.               |
| SLOT_NAME                  | Variable               | ---              | Deployment slot name for slot deployments              |

### Dataflows Function App

| Name                       | Type (Secret/Variable) | Is Flexion Only? | Description                                            |
| -------------------------- | ---------------------- | ---------------- | ------------------------------------------------------ |
| CAMS_ENABLED_DATAFLOWS     | Variable               | ---              | Sets up which dataflows are active on deployment |

### Key Vault

| Name                        | Type (Secret/Variable) | Is Flexion Only? | Description                                                                                                 |
| --------------------------- | ---------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| AZ_KV_APP_CONFIG_NAME       | Secrets                | ---              | Specifies existing Application Configuration KeyVault                                                       |
| AZ_KV_APP_CONFIG_MANAGED_ID | Secrets                | ---              | Used by bicep to provide an existing managed identity access the Application Configuration KeyVault Secrets |
| AZ_KV_APP_CONFIG_RG_NAME    | Secrets                | ---              | Used by bicep to provide scope for the managed identity                                                     |

## Key Vault Secrets

| Secret Name                    | Description                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| ACMS-MSSQL-DATABASE            | Database name for ACMS replication                                                                                              |
| ACMS-MSSQL-ENCRYPT             | A boolean determining whether or not the connection will be encrypted. Set to true if you're on Windows Azure. (default: false) |
| ACMS-MSSQL-HOST                | SQL Server host name                                                                                                            |
| ACMS-MSSQL-PASS                | SQL Server service account password                                                                                             |
| ACMS-MSSQL-TRUST-UNSIGNED-CERT | A boolean, that verifies whether server's identity matches it's certificate's names (default: true)                             |
| ACMS-MSSQL-USER                | SQL Server service account username                                                                                             |
| ADMIN-KEY                      | API key for admin endpoints                                                                                                     |
| CAMS-USER-GROUP-GATEWAY-CONFIG | IDP group API connection key/value pairs (see concrete implementation of identity client)                                       |
| FEATURE-FLAG-SDK-KEY           | Feature flag provider sdk key                                                                                                   |
| MONGO-CONNECTION-STRING        | Cosmos DB Mongo account connection string                                                                                       |
| MSSQL-DATABASE-DXTR            | Database name for DXTR data                                                                                                     |
| MSSQL-ENCRYPT                  | A boolean determining whether or not the connection will be encrypted. Set to true if you're on Windows Azure. (default: false) |
| MSSQL-HOST                     | SQL Server host name                                                                                                            |
| MSSQL-PASS                     | SQL Server service account password                                                                                             |
| MSSQL-TRUST-UNSIGNED-CERT      | A boolean, that verifies whether server's identity matches it's certificate's names (default: true)                             |
| MSSQL-USER                     | SQL Server service account username                                                                                             |
