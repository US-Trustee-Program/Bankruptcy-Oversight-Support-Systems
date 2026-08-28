# Deployment

## USTP vs Flexion Environment Differences

CAMS is deployed to two distinct environment types with different requirements:

- **Flexion Environments**: Development and testing environments managed by Flexion, deployed via
  GitHub Actions workflows
- **USTP Environments**: Production and staging environments managed by USTP, deployed via Azure
  DevOps pipelines

### Deployment Pipelines

| Environment | Tool           | Location                          |
| ----------- | -------------- | --------------------------------- |
| Flexion     | GitHub Actions | `.github/workflows/` in CAMS repo |
| USTP        | Azure DevOps   | `ADO-Mirror` repository           |

Both pipelines use the same Infrastructure as Code (Bicep templates) and shell scripts to ensure
deployed environments are as similar as possible, with differences limited to security and access
policies.

### Network Security and Firewall Rules

The most significant difference between environments is network access control:

| Resource               | Slot       | USTP                                   | Flexion                                |
| ---------------------- | ---------- | -------------------------------------- | -------------------------------------- |
| Webapp                 | Production | Deny-by-default + explicit allow rules | Publicly accessible (Allow all)        |
| Webapp                 | Staging    | Deny-by-default + explicit allow rules | Deny-by-default                        |
| API Function App       | Production | Deny-by-default + explicit allow rules | Publicly accessible (Allow all)        |
| API Function App       | Staging    | Deny-by-default + explicit allow rules | Deny-by-default                        |
| Dataflows Function App | Production | Deny-by-default + explicit allow rules | Deny-by-default + explicit allow rules |
| Dataflows Function App | Staging    | Deny-by-default + explicit allow rules | Deny-by-default                        |

**Key Principles:**

- **USTP**: All resources are deny-by-default with explicit allow rules for authorized access only
- **Flexion**: Production webapp and API function are publicly accessible to facilitate testing and
  demos
- **Dataflows**: Always deny-by-default in both environments (internal-only service)

### The `isUstpDeployment` Flag

The `isUstpDeployment` parameter/flag is used throughout the deployment tooling to toggle
environment-specific behavior:

**Bicep Templates** (`ops/cloud-deployment/*.bicep`):

- `isUstpDeployment` parameter determines firewall rules in Infrastructure as Code
- Example: `action: isUstpDeployment ? 'Deny' : 'Allow'`

**Shell Scripts** (`ops/scripts/pipeline/*.sh`):

- Scripts accept `--isUstpDeployment` flag to handle environment-specific logic
- Used in: `endpoint-test.sh`, `dev-add-allowed-ip.sh`, `dev-rm-allowed-ip.sh`
- Example: ADO pipelines pass `--isUstpDeployment`, GHA workflows do not

**Important**: When adding scripts that modify firewall rules, always check if behavior should
differ between USTP and Flexion environments.

### Post-Swap Firewall Handling

Azure slot swaps exchange all slot settings, including firewall configurations. This requires
post-swap correction:

**What happens during swap:**

1. Staging slot code (with Deny firewall) → Production slot
2. Production slot code (with Allow firewall for Flexion) → Staging slot

**Post-swap corrections** (GHA `enable-access` job in `sub-deploy-code-slot.yml`):

- **Webapp production**: Add AllowAll rule (Flexion only)
- **API production**: Add AllowAll rule (Flexion only)
- **Dataflows production**: Keep deny-by-default (both environments)
- **All staging slots**: Set to deny-by-default (both environments)

### Common Gotchas

1. **Dataflows is different**: Dataflows function app is always deny-by-default, even in Flexion
   production. Don't include it in scripts that add public Allow rules.

2. **Production ≠ Publicly accessible**: In USTP, production slots are deny-by-default. The term
   "production" refers to the main slot, not accessibility.

3. **Scripts need environment awareness**: When writing scripts that modify access restrictions, use
   the `--isUstpDeployment` flag if behavior differs between environments.

4. **Test both pipeline types**: Changes to deployment scripts should be validated in both GHA
   (Flexion) and ADO (USTP) pipelines.

## Infrastructure as Code

Bicep files are used to provision resources in the Azure cloud environment with support for both
commercial and US gov regions and are located in the ops/cloud-deployment folder. The bicep files
are broken down to deploy a subset of what is needed by USTP Case Management System (CAMS). Use the
**main bicep**, _main.bicep_, to provision complete Azure resources.

Note the following assumptions:

- Account used to execute bicep code has the necessary permission to provision all resources.
- Prior to running the _main.bicep_ file, the _ustp-cams-kv-app-config-setup.bicep_ file must be run
  first with the **deployNetworkConfig** param set to false
- After running the _main.bicep_ file, the _ustp-cams-kv-app-config-setup.bicep_ file must be run
  first with the **deployNetworkConfig** param set to **true**

## SQL Private Link Hub

A single shared Private Endpoint reaches the SQL server, and every consumer VNet (main and each
branch, in any region) peers to the hub VNet that holds it. This exists because Azure requires a SQL
`virtualNetworkRules` subnet to be in the **same region** as the server, which cross-region branch
compute cannot satisfy; a Private Endpoint has no such restriction.

One endpoint, not one per consumer, is the load-bearing part. A private DNS zone holds exactly one A
record for the server's single canonical hostname, so per-consumer endpoints fight over it — and
tearing one down deletes the record out from under everybody else.

### One-time setup

Run the **Deploy SQL Private Link Hub** workflow (`.github/workflows/deploy-sql-hub.yml`,
`workflow_dispatch` only). Choose `what-if` first and read the plan; re-run with `deploy` to apply.

It is deliberately **not** part of continuous deployment. Every environment's SQL resolution depends
on this one endpoint, so redeploying it must be a deliberate act, never a side effect of a branch
deploy or teardown.

### Identity and permissions

**No additional role assignments are required.** The workflow authenticates as
`cams-infrastructure-deploy-main-oidc` through the existing `infrastructure-deploy-main`
environment, and that identity already holds `Contributor` at **subscription** scope. That covers
everything involved: creating the hub VNet, subnet, and Private Endpoint, and writing the A record
into the private DNS zones in `rg-cams-network` and `rg-cams-network-dev`.

A dedicated `sql-hub` identity was considered and rejected: it would need those same permissions
granted from scratch, so it would add a principal without narrowing anything.

Note that the hub writes into **consumer-owned** zones, which inverts "the hub owns its own
lifecycle". That is the deliberate trade for a zero-downtime cutover. The alternative — a third zone
of the same name in the hub RG — cannot be adopted without an outage, because Azure rejects linking
one VNet to two zones sharing a name, so every consumer would have to unlink before it could relink
and would resolve nothing in between.

> [!IMPORTANT] What this workflow **does** require is its own federated credential. The repository's
> OIDC subject template is `repo + workflow + environment` (see
> [GitHub Actions OIDC Least Privilege](../architecture/decision-records/GithubActionsOidcLeastPrivilege.md)),
> so the subject names the workflow, not just the environment. A standalone `workflow_dispatch`
> workflow reports its **own** name; only reusable workflows invoked from Continuous Deployment
> report the caller's name. Reusing an environment is therefore not sufficient on its own.

The credential already exists (`gha-deploy-sql-hub` on `cams-infrastructure-deploy-main-oidc`). Any
future standalone workflow needs its own, created like this:

```bash
az ad app federated-credential create --id <app-object-id> --parameters '{
  "name": "gha-<workflow-slug>",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:US-Trustee-Program/Bankruptcy-Oversight-Support-Systems:workflow:<Workflow Name>:environment:<environment>",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

### Migrating a consumer onto the hub

Per consumer, in this order. **The order matters.**

1. Confirm both peering sides report `Connected`, not `Initiated`.
2. **Delete that consumer's own SQL Private Endpoint.**
3. Re-run the hub workflow so the shared endpoint registers the A record.
4. Verify resolution from inside the consumer's VNet before moving on.

Step 2 must precede step 3. Deleting an endpoint deletes its zone-group records, so if the hub
registered while the old endpoint still existed, two zone groups would write the same A record —
recreating the last-delete-wins collision this design removes.

That leaves a window between steps 2 and 3 with no record. It is covered by
`resolutionPolicy: NxDomainRedirect` on the VNet links (`lib/network/vnet-links.bicep`), which makes
Azure fall back to public resolution instead of returning NXDOMAIN. Confirmed available in Azure
Government; requires api-version `2024-06-01` or higher.

The policy only applies to links the template manages. Links skipped via `vnetLinkAlreadyExists`
keep their old setting and need a one-time:

```bash
az network private-dns link vnet update \
  -g <zone-rg> -z privatelink.database.usgovcloudapi.net \
  -n <link-name> --resolution-policy NxDomainRedirect
```

### Cutover runbook

Four stages, in order. Stages 2 and 3 each depend on a code change that must be merged first, so
this is not a single sitting.

Before starting any stage, establish where you are:

```bash
for RG in bankruptcy-oversight-support-systems rg-cams-network rg-cams-network-dev; do
  echo -n "$RG -> "
  az network private-dns record-set a show -g "$RG" \
    -z privatelink.database.usgovcloudapi.net -n sql-ustp-cams \
    --query 'aRecords[].ipv4Address' -o tsv 2>/dev/null || echo ABSENT
done

az network vnet peering list -g bankruptcy-oversight-support-systems \
  --vnet-name vnet-ustp-cams-sql-hub \
  --query '[].{name:name,state:peeringState}' -o table

az network private-endpoint list -g rg-cams-network \
  --query "[?contains(name,'sql')].name" -o tsv
```

A consumer is migrated when its zone's A record points at the hub (`10.20.0.4`) and it no longer
owns a SQL Private Endpoint.

Health is the signal that matters at every checkpoint. `status` is `ERROR` and the endpoint returns
HTTP 500 whenever `sqlDbReadStatus` is false:

```bash
curl -s https://ustp-cams-node-api.azurewebsites.us/api/healthcheck | jq '.data.database'
```

#### Stage 1 — migrate main

Main is the first real consumer. It is also the one still depending on `pep-ustp-cams-main-sql`, an
endpoint created by hand during the original incident and described nowhere in this repository —
retiring it is the point of this stage.

1. **Confirm the peering is `Connected`.** `main.bicep` creates it when `createMainHubPeering` is
   true, which `reusable-deploy.yml` gates on `Main-Gov`, so a main deploy has already done this.

   ```bash
   az network vnet peering list -g rg-cams-network --vnet-name vnet-ustp-cams \
     --query "[?contains(name,'sql-hub')].{name:name,state:peeringState}" -o table
   ```

2. **Preview.** Run **Deploy SQL Private Link Hub** with `mode=what-if`,
   `consumerZones=main-only`. Expect the endpoint's DNS zone config to repoint from the hub's own
   resource group to `rg-cams-network`, and nothing else of substance.

   > [!NOTE] `what-if` reports `- properties.virtualNetworkPeerings` on the hub VNet. That is a
   > false positive — verified against throwaway resources, peerings survive an ARM PUT that omits
   > them, including one carrying a real property change. Do not act on it.

3. **Capture the endpoint before deleting it.** It exists in no template, so this output is the
   only rollback material there is.

   ```bash
   az network private-endpoint show -g rg-cams-network -n pep-ustp-cams-main-sql \
     > /tmp/pep-ustp-cams-main-sql.json
   az network private-endpoint dns-zone-group list -g rg-cams-network \
     --endpoint-name pep-ustp-cams-main-sql >> /tmp/pep-ustp-cams-main-sql.json
   ```

4. **Delete it.** The record disappears with it — that is expected and is what step 5 restores.

   ```bash
   az network private-endpoint delete -g rg-cams-network -n pep-ustp-cams-main-sql
   ```

5. **Register the hub.** Re-run the workflow with `mode=deploy`, `consumerZones=main-only`.

6. **Verify.** `rg-cams-network` should now resolve to `10.20.0.4`, and the healthcheck should
   report `sqlDbReadStatus: true`. Function apps cache DNS, so allow a few minutes or restart them.

Between steps 4 and 5 main has no private record and falls back to public resolution via
`NxDomainRedirect`. Main's SQL VNet rule is still in place as a second fallback until stage 3.

**Rollback.** Re-run the workflow with `consumerZones=both` to restore prior registration
behaviour, and recreate the endpoint from the captured JSON. The fallback means a failed cutover
degrades rather than disconnects, so prefer diagnosing forward over rolling back — a partial
rollback that leaves two endpoints registering into one zone recreates the collision.

#### Stage 2 — migrate branches

> [!IMPORTANT] Requires the change that lets a consumer reach SQL through the hub without creating
> its own endpoint. Until then, `useSqlPrivateLink` selects between a per-consumer Private Endpoint
> and a same-region-only VNet rule, and neither is the hub. Do not attempt this stage before that
> ships.

1. Confirm each live branch has a `Connected` hub peering.
2. Delete every branch SQL Private Endpoint. Each branch has two, one per function app:

   ```bash
   az network private-endpoint list -g rg-cams-network-dev \
     --query "[?ends_with(name,'-sql')].name" -o tsv
   ```

3. Re-run the workflow with `consumerZones=both`.
4. Verify each branch's healthcheck at
   `https://<env>-node-api.azurewebsites.us/api/healthcheck`.

#### Stage 3 — decommission

Only once main and all branches are verified on the hub, and have been for long enough to trust it.
This removes the fallback paths, so it is the least reversible stage.

1. Retire `sql-vnet-rule.bicep` / `createSqlServerVnetRule` (code change).
2. Delete the remaining SQL VNet rules, including those belonging to environments that no longer
   exist:

   ```bash
   az sql server vnet-rule list -g bankruptcy-oversight-support-systems -s sql-ustp-cams -o table

   RULE='<name-from-the-list-above>'
   az sql server vnet-rule delete -g bankruptcy-oversight-support-systems -s sql-ustp-cams -n "$RULE"
   ```

3. Remove the `consumerZones` input from the workflow — `both` is the steady state and the input
   only exists to stage this migration.

#### Stage 4 — cleanup

Housekeeping; no consumer depends on any of it.

- The orphaned `privatelink.database.usgovcloudapi.net` zone in
  `bankruptcy-oversight-support-systems`, left from an earlier hub design. Confirm it has zero VNet
  links before deleting.
- Legacy per-branch network resource groups (`rg-cams-network-dev-*`) whose environments are gone.
- Orphaned `CAMS_E2E-*` SQL databases and `cams-e2e-*` Cosmos databases.

```bash
az network private-dns link vnet list -g bankruptcy-oversight-support-systems \
  -z privatelink.database.usgovcloudapi.net --query 'length(@)' -o tsv
```

### Branch address allocation

Branch VNets peering to the hub must not overlap, so a branch claims a `/20` from a reserved
`10.128.0.0/12` pool (`ops/scripts/pipeline/_branch-network-pool.sh`). Legacy branches created
before this — anything still on `10.10.0.0/16` — are left alone: they keep working through their
existing path and simply get no hub peering. Re-addressing one is opt-in via
`--allowLegacyVnetReaddress true`, and is only safe when nothing is deployed into its subnets, since
Azure rejects address-space changes on in-use subnets.

## CI/CD Pipeline Runtime Variables

?> Note required environment variables and secrets defined in build tool for pipeline execution in
Flexion and **shared** with USTP.

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

| Name                           | Type (Secret/Variable) | Is Flexion Only? | Description                                                                                                                                     |
| ------------------------------ | ---------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| AZURE_SUBSCRIPTION             | Secret                 | ---              | Azure Subscription ID                                                                                                                           |
| AZURE_CREDENTIALS              | Secret                 | ---              | Credentials for Azure Cloud Environment                                                                                                         |
| AZURE_ENVIRONMENT              | Variable               | Yes              | Specify target Azure cloud environment.                                                                                                         |
| AZ_APP_RG                      | Secret                 | ---              | Resource group name for all application related infrastructure.                                                                                 |
| AZURE_RG                       | Secret                 | ---              | Resource group for miscellaneous Azure resources                                                                                                |
| AZ_PLAN_TYPE                   | Variable               | ---              | Determine plan type for Azure App Service plans.                                                                                                |
| AZ_ACTION_GROUP_NAME           | Secret                 | ---              | Action Group Name for Azure Alerts                                                                                                              |
| AZ_PRIVATE_DNS_ZONE            | Variable               | ---              | Private DNS Zone name                                                                                                                           |
| AZ_PRIVATE_DNS_ZONE_RG         | Secret                 | ---              | Private DNS Zone Azure resource group name                                                                                                      |
| AZ_PRIVATE_DNS_ZONE_ID         | Secret                 | ---              | Private DNS Zone Azure Fully qualified ID                                                                                                       |
| AZ_NETWORK_RG                  | Secret                 | ---              | Resource Group for networking components                                                                                                        |
| AZ_NETWORK_VNET_NAME           | Variable               | ---              | Virtual Network Name                                                                                                                            |
| AZ_SQL_SERVER_NAME             | Secret                 | ---              | ---                                                                                                                                             |
| AZ_SQL_IDENTITY_NAME           | Secret                 | ---              | Name of Azure managed identity with access to SQL Server database. Required if not using SQL Auth                                               |
| AZ_COSMOS_DATABASE_NAME        | Secret                 | ---              | ---                                                                                                                                             |
| AZ_COSMOS_MONGO_ACCOUNT_NAME   | Secret                 | ---              | ---                                                                                                                                             |
| AZ_COSMOS_ID_NAME              | Secret                 | ---              | Name of Managed Identity accessing cosmos                                                                                                       |
| AZ_ANALYTICS_WORKSPACE_ID      | Secret                 | ---              | Azure resource id of Log Analytics.                                                                                                             |
| AZ_ACTION_GROUP_NAME           | Secret                 | Yes              | Action Group Name for alert rules                                                                                                               |
| ADMIN-NOTIFICATION-EMAIL       | Secret                 | Yes              | Optional email for ACS delivery-failure alerts; leave empty to skip the alert. New Action Group receivers require manual passcode verification. |
| DEFAULT-NOTIFICATION-RECIPIENT | Secret                 | Yes              | Optional fallback email recipient for notifications when no Cosmos routing record matches a case.                                               |

### Snyk

| Name                          | Type (Secret/Variable) | Is Flexion Only? | Description                                                      |
| ----------------------------- | ---------------------- | ---------------- | ---------------------------------------------------------------- |
| SNYK_OAUTH_CLIENT_ID          | Secrets                | ---              | OAuth client ID for Snyk government instance                     |
| SNYK_OAUTH_CLIENT_SECRET      | Secrets                | ---              | OAuth client secret for Snyk government instance                 |
| AZ_SECURITY_SCAN_RG           | Secrets                | ---              | Resource group for the security scan storage account             |
| AZ_SECURITY_SCAN_STORAGE_NAME | Secrets                | ---              | Storage account name for security scan results (deployed by IaC) |

### LaunchDarkly

| Name                     | Type (Secret/Variable) | Is Flexion Only? | Description                            |
| ------------------------ | ---------------------- | ---------------- | -------------------------------------- |
| LD_DEVELOPMENT_CLIENT_ID | Secrets                | ---              | Client ID for LaunchDarkly Environment |

### API Function App

| Name                      | Type (Secret/Variable) | Is Flexion Only? | Description                                            |
| ------------------------- | ---------------------- | ---------------- | ------------------------------------------------------ |
| STARTING_MONTH            | Variable               | ---              | Used by application for filtering cases by date range. |
| USTP_ISSUE_COLLECTOR_HASH | Secrets                | ---              | USTP Only parameter used for CSP policy.               |
| SLOT_NAME                 | Variable               | ---              | Deployment slot name for slot deployments              |

### Dataflows Function App

| Name                   | Type (Secret/Variable) | Is Flexion Only? | Description                                                                                                                                            |
| ---------------------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CAMS_ENABLED_DATAFLOWS | Variable               | ---              | Sets up which dataflows are active on deployment. Comma-separated list of MODULE_NAME values. See [running.md](../running.md) for available dataflows. |

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
