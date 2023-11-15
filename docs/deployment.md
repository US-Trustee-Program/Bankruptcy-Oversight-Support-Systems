# Deployment

## Pipeline Environment Variables

Note required environment variables and secrets defined in build tool for pipeline execution in Flexion and **shared** with USTP.

| Name                                       | Type (Secret/Variable) | Is Flexion Only? | Description                                                                                                 |
| ------------------------------------------ | ---------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| APP_NAME                                   | Variable               |                  | Name used to label resource stack in Azure.                                                                 |
| DEV_SUFFIX                                 | Variable               | Yes              | Suffix added to label resource stack in Azure for non-main branch deployments.                              |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Frontend**                               |                        |                  |                                                                                                             |
| CAMS_BASE_PATH                             | Variable               | ---              | Required for frontend build step.                                                                           |
| CAMS_SERVER_PORT                           | Variable               | ---              | Required for frontend build step.                                                                           |
| CAMS_SERVER_PROTOCOL                       | Variable               | ---              | Required for frontend build step.                                                                           |
| CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING | Secret                 | ---              | Optional for log ingestion to Azure Log Analytics.                                                          |
| CAMS_FEATURE_FLAG_CLIENT_ID                | Secret                 | ---              | Optional client id to enable LaunchDarkly                                                                   |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Azure**                                  |                        |                  |                                                                                                             |
| AZURE_SUBSCRIPTION                         | Secret                 | ---              | Azure Subscription ID                                                                                       |
| AZURE_CREDENTIALS                          | Secret                 | ---              | Credentials for Azure Cloud Environment                                                                     |
| AZURE_ENVIRONMENT                          | Variable               | Yes              | Specify target Azure cloud environment.                                                                     |
| AZ_HOSTNAME_SUFFIX                         | Variable               | ---              | e.g. (.us, .com, .net)                                                                                      |
| AZ_APP_RG                                  | Secret                 | ---              | Resource group name for all application related infrastructure.                                             |
| AZ_NETWORK_RG                              | Secret                 | ---              | Resource group name for all network related infrastructure.                                                 |
| AZ_DATA_SOURCE_RG                          | Secret                 | ---              | Resource group name for all data storage related infrastructure.                                            |
| AZURE_RG                                   | Secret                 | ---              | Resource group for miscellanous Azure resources                                                             |
| AZ_PLAN_TYPE                               | Variable               | ---              | Determine plan type for Azure App Service plans.                                                            |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Azure Network**                          | ---                    | ---              | ---                                                                                                         |
| AZ_PRIVATE_DNS_ZONE                        | Variable               | ---              | Private DNS Zone name                                                                                       |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Azure SQL Server**                       | ---                    | ---              | ---                                                                                                         |
| AZ_SQL_CONN_STR                            | Secret                 | ---              | ---                                                                                                         |
| AZ_SQL_SERVER_NAME                         | Secret                 | ---              | ---                                                                                                         |
| AZ_MSSQL_HOST                              | Secret                 | ---              | ---                                                                                                         |
| ~~AZ_MSSQL_DATABASE~~                      | ~~Secret~~             | ---              | ~~ACMS database name~~ added to KeyVault                                                                    |
| ~~AZ_MSSQL_DATABASE_DXTR ~~                | ~~Secret~~             | ---              | ~~DXTR database name~~ added to KeyVault                                                                    |
| ~~AZ_MSSQL_USER~~                          | ~~Secret~~             | ---              | added to KeyVault---                                                                                        |
| ~~AZ_MSSQL_PASS~~                          | ~~Secret~~             | ---              | added to KeyVault---                                                                                        |
| ~~AZ_MSSQL_ENCRYPT~~                       | ~~Secret~~             | ---              | added to KeyVault---                                                                                        |
| ~~AZ_MSSQL_TRUST_UNSIGNED_CERT~~           | ~~Secret~~             | ---              | added to KeyVault---                                                                                        |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Azure CosmosDb**                         | ---                    | ---              | ---                                                                                                         |
| AZ_COSMOS_DATABASE_NAME                    | Secret                 | ---              | ---                                                                                                         |
| AZ_COSMOS_ACCOUNT_NAME                     | Secret                 | ---              | ---                                                                                                         |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Veracode**                               |                        |                  |                                                                                                             |
| VERACODE_APP_ID                            | Secrets                | Yes              | Reference application identifier for scan results.                                                          |
| VERACODE_API_ID                            | Secrets                | Yes              | ---                                                                                                         |
| VERACODE_API_KEY                           | Secrets                | Yes              | ---                                                                                                         |
| SRCCLR_API_TOKEN                           | Secrets                | Yes              | API Token for Static Code Analysis                                                                          |
| SRCCLR_REGION                              | Secrets                | Yes              | Region for Statis Code analysis                                                                             |
| AZ_STOR_VERACODE_NAME                      | Secrets                | Yes              | Azure Storage account name for veracode scans                                                               |
| AZ_STOR_VERACODE_KEY                       | Secrets                | Yes              | Access key for Azure Storage account                                                                        |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **LaunchDarkly**                           |                        |                  |                                                                                                             |
| ~~FEATURE_FLAG_SDK_KEY~~                   | ~~Secrets~~            | ---              | ~~Optional SDK key to enable LaunchDarkly~~ added to KeyVault                                               |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Azure Log Anlaytics**                    |                        |                  |                                                                                                             |
| AZ_ANALYTICS_WORKSPACE_ID                  | Secrets                | ---              | Azure resource id of Log Analytics.                                                                         |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Azure Alert**                            |                        |                  |                                                                                                             |
| AZ_ACTION_GROUP_NAME                       | Secrets                | Yes              | Action Group Name for alert rules                                                                           |
| ---                                        | ---                    | ---              | ---                                                                                                         |
| **Application**                            | ---                    | ---              | ---                                                                                                         |
| STARTING_MONTH                             | Variable               | ---              | Used by application for filtering cases by date range.                                                      |
| USTP_ISSUE_COLLECTOR_HASH                  | Secrets                | ---              | USTP Only parameter used for CSP policy                                                                     |
| **KeyVault**                               | ---                    | ---              | ---                                                                                                         |
| AZ_KV_APP_CONFIG_NAME                      | Secrets                | ---              | Specifies existing Application Configuration KeyVault                                                       |
| AZ_KV_APP_CONFIG_MANAGED_ID                | Secrets                | ---              | Used by bicep to provide an existing managed identity access the Application Configuration KeyVault Secrets |
| AZ_KV_APP_CONFIG_RG_NAME                   | Secrets                | ---              | Used by bicep to provide scope for the managed identity                                                     |
