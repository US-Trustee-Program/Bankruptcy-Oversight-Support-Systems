import {
  virtualNetworkName as virtualNetworkNameFor
  webappName as webappNameFor
  webappSubnetName as webappSubnetNameFor
  apiFunctionName as apiFunctionNameFor
  apiFunctionSubnetName as apiFunctionSubnetNameFor
  dataflowsFunctionName as dataflowsFunctionNameFor
  dataflowsSubnetName as dataflowsSubnetNameFor
  privateEndpointSubnetName as privateEndpointSubnetNameFor
} from './lib/naming.bicep'

param stackName string

param deployedAt string = utcNow()

param location string = resourceGroup().location

param appResourceGroup string = resourceGroup().name

// This default (and webappSubnetName/privateEndpointSubnetName further below)
// is computed via the shared functions in lib/naming.bicep, which
// network.bicep imports too — so the `existing` lookups below
// (ustpVirtualNetwork, *SubnetExisting), for resources network.bicep creates,
// can no longer silently drift out of sync.
// app-shared-setup.bicep already imports and uses virtualNetworkNameFor
// from naming.bicep too. Only reusable-deploy.yml / reusable-build-info.yml
// still duplicate this formula in bash for their vnet-existence checks —
// those two still need manual lockstep.
param virtualNetworkName string = virtualNetworkNameFor(stackName)

param networkResourceGroupName string

param privateDnsZoneName string = 'privatelink.azurewebsites.us'

param privateDnsZoneResourceGroup string = networkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

@description('Set true when the deploying pipeline has already confirmed a vnet link into the webapp private DNS zone exists (see vnet-links.bicep) -- avoids a Conflict from trying to create a second, differently-named link. Mirrors the param of the same shape that used to live on app-shared-setup.bicep before the webapp zone\'s vnet link moved here.')
param webappVnetLinkAlreadyExists bool = false

@description('When true, the API and dataflows function apps reach the SQL server via a Private Endpoint (privatelink.database.usgovcloudapi.net) instead of the sql-vnet-rule.bicep VNet rule. Required for cross-region branches (AZ-FUNCTIONS-LOCATION set) because Azure enforces same-region between a SQL server and any subnet referenced by a virtualNetworkRules resource, but a Private Endpoint has no such restriction. Defaults to false, preserving today\'s VNet-rule behavior for main and same-region branches unchanged.')
param useSqlPrivateLink bool = false

@description('Fixed Azure Government private-link DNS zone name for Azure SQL -- see app-shared-setup.bicep (sqlDnsZone module) for why this is a separate zone from the webapp/api/dataflows one and where it is created.')
param sqlPrivateDnsZoneName string = 'privatelink.database.usgovcloudapi.net'

@description('Set true when the deploying pipeline has already confirmed a vnet link into the SQL private DNS zone exists (see vnet-links.bicep) -- avoids a Conflict from trying to create a second, differently-named link. Mirrors webappVnetLinkAlreadyExists above.')
param sqlVnetLinkAlreadyExists bool = false

@description('Set true when the deploying pipeline has confirmed the SQL private DNS zone itself exists in privateDnsZoneResourceGroup (azure-deploy.sh computes this via zone_exists_for). Gates ustpSqlDnsZoneLink below, because a vnet link is a child of the zone and linking into an absent zone fails the whole deployment with ParentResourceNotFound rather than degrading. Distinct from sqlVnetLinkAlreadyExists above: that one asks whether a LINK exists, this one asks whether the ZONE does. Defaults false so any caller that does not compute it -- notably the USTP ADO pipeline template, which cannot be changed without a multi-step change on government-furnished equipment -- gets the safe no-op instead of a failed deploy.')
param sqlDnsZoneExists bool = false
@description('Flag: creates the peering connecting main\'s own VNet (virtualNetworkName, in networkResourceGroupName) to the shared SQL Private Link hub VNet (see lib/network/sql-hub.bicep, Goal 1 of cams-vwsp3). Should only be true for the Main-Gov deploy -- same shape as createAlerts above, gated in reusable-deploy.yml on `ghaEnvironment == \'Main-Gov\'`, because hubVirtualNetworkResourceGroupName below is a FIXED resource group, not one derived from this branch\'s stackName; every branch flipping this on would mean every branch\'s stack independently declares a peering resource under the SAME fixed hub-facing name pattern, which is unnecessary (main\'s peering already gives every branch DNS/route visibility once branches migrate to resolve through the hub -- a later goal) and adds churn for no benefit. Defaults false so branch deploys never touch this.')
param createMainHubPeering bool = false

@description('Name of the shared SQL Private Link hub VNet (see lib/network/sql-hub.bicep). Fixed -- deployed once, directly, not derived from any stackName.')
param hubVirtualNetworkName string = 'vnet-ustp-cams-sql-hub'

@description('Resource group containing the hub VNet above -- the SQL server\'s own resource group (bankruptcy-oversight-support-systems), not networkResourceGroupName. Fixed for the same reason as hubVirtualNetworkName.')
param hubVirtualNetworkResourceGroupName string = 'bankruptcy-oversight-support-systems'

param privateEndpointSubnetName string = privateEndpointSubnetNameFor(stackName)

param webappName string = webappNameFor(stackName)

param webappSubnetName string = webappSubnetNameFor(stackName)

@description('Plan type to determine webapp service plan Sku.')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param webappPlanType string = 'P1v2'

@description('SKU for the API and dataflows function app plans. EP1 (Elastic Premium) is the default; S1 (Standard) is available for environments where EP1 capacity is constrained.')
@allowed([
  'EP1'
  'S1'
])
param functionsPlanType string = 'EP1'

param apiFunctionName string = apiFunctionNameFor(stackName)

param apiFunctionSubnetName string = apiFunctionSubnetNameFor(stackName)

param dataflowsFunctionName string = dataflowsFunctionNameFor(stackName)

param dataflowsSubnetName string = dataflowsSubnetNameFor(stackName)

param apiFunctionPlanName string = 'plan-${stackName}-functions-api'

param dataflowsFunctionPlanName string = 'plan-${stackName}-functions-dataflows'


@description('Name of deployment slot for frontend and backend')
param slotName string

param sqlServerName string = ''

param sqlServerResourceGroupName string = ''

@description('Name for managed identity of database server.')
param sqlServerIdentityName string = ''

param sqlServerIdentityResourceGroupName string = ''

@description('Subscription containing the SQL managed identity; defaults to the deploying subscription.')
param sqlServerIdentitySubscriptionId string = ''

@description('Name of the managed identity with read access to the keyvault storing application configurations. ')
@secure()
param idKeyvaultAppConfiguration string

param kvAppConfigResourceGroupName string = sqlServerResourceGroupName

@description('name of the app config KeyVault')
param kvAppConfigName string = 'kv-${stackName}'

@description('Flag: Determines creation and configuration of Alerts.')
param createAlerts bool = false

param actionGroupName string =''

@description('Flag: determines creation and configuration of Application Insights for the Azure Function.')
param deployAppInsights bool = false

param analyticsWorkspaceId string = ''

param analyticsResourceGroupName string

@description('Url for our Okta Provider')
param oktaUrl string = ''

param loginProviderConfig string = ''

param loginProvider string = ''

param isUstpDeployment bool = false

param mssqlRequestTimeout string = '15000'

param maxObjectDepth string

param maxObjectKeyCount string

@description('Fallback email recipient for notifications when no Cosmos routing record matches')
param defaultNotificationRecipient string = ''

@description('Used to set Content-Security-Policy for USTP.')
@secure()
param ustpIssueCollectorHash string = ''

param cosmosDatabaseName string
param e2eDatabaseName string = cosmosDatabaseName
param e2eSqlDatabaseName string = 'CAMS_E2E'

@description('Comma delimited list of data flow names to enable.')
param enabledDataflows string = ''

@description('Rows fetched from ACMS per migrate-case-appointments continuation. Empty string uses the function app default.')
param migrateCaseAppointmentsFetchSize string = ''

@description('Custom domain FQDN for sending email. Leave empty to use Azure-managed subdomain.')
param customDomain string = ''

@description('Name of the blob container used for migration and operational artifacts.')
param objectContainerName string = 'migration-files'

param gitSha string

var webappTags = {
  app: 'cams'
  component: 'webapp'
  'deployed-at': deployedAt
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

// GUARD: this module deploys into the SHARED analyticsResourceGroupName, but
// main.bicep is wrapped in a per-branch Deployment Stack for branch deploys
// (see azure-deploy.sh). A stack owns -- and on teardown DELETES -- every
// resource its template creates in ANY resource group, which is how a branch
// teardown once deleted the shared Key Vault. It is safe ONLY
// because createAlerts is wired to `ghaEnvironment == 'Main-Gov'`
// (reusable-deploy.yml), so this module never actually instantiates for a
// branch deploy, and Main-Gov itself is never stacked. Before changing
// createAlerts to also be true for a branch/dev environment, first move this
// module into app-shared-setup.bicep (the metrics/log alert-rule modules that
// reference it do so by an `existing` name+RG lookup, not a bicep dependsOn,
// so relocating it is safe) — do not just flip the flag.
module actionGroup './lib/monitoring-alerts/alert-action-group.bicep' =
  if (createAlerts) {
    name: '${actionGroupName}-action-group-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      actionGroupName: actionGroupName
    }
  }

// The virtual network and subnets are deployed by network.bicep as a separate
// deployment (its own Azure Deployment Stack — CAMS-760, Option E). main.bicep
// is app-resource-group scoped and consumes those subnets via `existing`
// references, so network.bicep MUST be deployed before this template.
// The private DNS zone itself is deployed separately too, always as a plain
// (non-stack) resource-group deployment, by app-shared-setup.bicep (see its
// header for why) — this template only consumes the zone by name/RG via the
// privateDnsZoneName/privateDnsZoneResourceGroup params above and creates its
// own vnet-link into it below (ustpWebappDnsZoneLink).
resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2023-11-01' existing = {
  name: virtualNetworkName
  scope: resourceGroup(networkResourceGroupName)
}

resource privateEndpointSubnetExisting 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  name: privateEndpointSubnetName
  parent: ustpVirtualNetwork
}

resource apiFunctionSubnetExisting 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  name: apiFunctionSubnetName
  parent: ustpVirtualNetwork
}

resource webappSubnetExisting 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  name: webappSubnetName
  parent: ustpVirtualNetwork
}

resource dataflowsFunctionSubnetExisting 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  name: dataflowsSubnetName
  parent: ustpVirtualNetwork
}

// The app-config Key Vault (+ its managed identity, DNS zone, and secret role
// assignments) and the SQL managed identity are deployed separately by
// app-shared-setup.bicep — always a plain (non-stack) deployment, before this
// template runs, because they are genuinely shared across main and every
// branch (see app-shared-setup.bicep for why). This template references them
// by the name/id strings passed in as params.
//
// This does NOT mean every module below is RG-local: the webapp/api/dataflows
// private endpoints (into the shared network RG) and the two SQL vnet-rule
// modules (into the shared SQL RG) declared in frontend-webapp-deploy.bicep,
// backend-api-deploy.bicep, and dataflows-resource-deploy.bicep are also
// cross-scope. Those are safe to leave inside this (stacked, for branches)
// template because each one is named using this branch's own stackName-derived
// value (webappName/apiFunctionName/dataflowsFunctionName, further disambiguated
// by uniqueString(subnetId) for the SQL vnet rules) — so a branch's own app
// stack deleting them on teardown is the intended behavior. The rule: only
// resources with a FIXED, shared name must live outside this stack, as the
// Key Vault and SQL managed identity do above.
module ustpWebappDnsZoneLink './lib/network/vnet-links.bicep' = {
  name: '${stackName}-webapp-dns-zone-link-module'
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
  params: {
    stackName: stackName
    virtualNetworkId: ustpVirtualNetwork.id
    privateDnsZoneName: privateDnsZoneName
    vnetLinkAlreadyExists: webappVnetLinkAlreadyExists
  }
}

// Same self-cleaning-per-branch-stack shape as ustpWebappDnsZoneLink above,
// for the SQL Private Link zone (see app-shared-setup.bicep's sqlDnsZone
// module for where the zone itself is created).
//
// UNCONDITIONAL, unlike the SQL Private Endpoint modules below (in
// backend-api-deploy.bicep / dataflows-resource-deploy.bicep), which stay
// gated on `useSqlPrivateLink`. This looks asymmetric right next to that
// condition, but it is deliberate, not an oversight: the SQL server
// (sql-ustp-cams) is shared across main and every branch. The moment ANY
// consumer's Private Endpoint against that server is approved, Azure
// CNAME-redirects the server's public FQDN to its privatelink subdomain --
// server-wide, not scoped to the requesting branch. Any other consumer of
// that server whose VNet isn't linked into this zone would then lose DNS
// resolution to it (their queries hit the CNAME, then fail to resolve
// because their VNet isn't linked to the zone holding the actual A record).
// Linking every branch's VNet here, unconditionally, keeps SQL DNS
// resolution working for everyone regardless of which single branch first
// flips useSqlPrivateLink on. Do not re-add an `if (useSqlPrivateLink)`
// condition to this module.
//
// It IS gated on sqlDnsZoneExists, which is a different axis and not a
// weakening of the above. A vnet link is a CHILD resource of the zone, so
// when the zone is absent this module cannot degrade gracefully -- it fails
// the entire deployment with ParentResourceNotFound. USTP hits exactly that:
// its ADO pipeline never runs app-shared-setup.bicep (which bootstraps this
// zone on Flexion) and passes deployDns=false, so the zone has never existed
// there and USTP staging could not deploy at all. Skipping a link into a zone
// that does not exist strands nobody: with no
// zone there is no privatelink A record for anything to resolve against, so
// every consumer in that environment is resolving the SQL FQDN publicly
// already. The rationale above only binds where the zone is actually present.
module ustpSqlDnsZoneLink './lib/network/vnet-links.bicep' = if (sqlDnsZoneExists) {
  name: '${stackName}-sql-dns-zone-link-module'
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
  params: {
    stackName: stackName
    virtualNetworkId: ustpVirtualNetwork.id
    privateDnsZoneName: sqlPrivateDnsZoneName
    vnetLinkAlreadyExists: sqlVnetLinkAlreadyExists
  }
}

// Connects main's VNet to the shared SQL Private Link hub. Purely additive:
// main still reaches SQL through its existing path, and migrating it onto the
// hub's endpoint is a separate operation. Main owns BOTH sides of its own
// peering, declared as two separately-scoped modules here -- one module call
// is one side (see vnet-peering.bicep's header) -- so onboarding a spoke never
// redeploys the shared endpoint every other environment depends on.
module mainHubPeering './lib/network/vnet-peering.bicep' = if (createMainHubPeering) {
  name: '${stackName}-main-hub-peering-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    localVirtualNetworkName: virtualNetworkName
    remoteVirtualNetworkId: resourceId(hubVirtualNetworkResourceGroupName, 'Microsoft.Network/virtualNetworks', hubVirtualNetworkName)
    peeringName: 'peer-${virtualNetworkName}-to-${hubVirtualNetworkName}'
  }
}

// The matching hub-side resource. A bidirectional peering is two independent
// resources, one nested under each VNet in that VNet's own resource group, so
// this is scoped to the hub RG rather than main's network RG. Without it main's
// side sits in Initiated and never reaches Connected, so no traffic flows.
// Requires the deploying identity to hold peering write on the hub RG.
module mainHubPeeringHubSide './lib/network/vnet-peering.bicep' = if (createMainHubPeering) {
  name: '${stackName}-hub-main-peering-module'
  scope: resourceGroup(hubVirtualNetworkResourceGroupName)
  params: {
    localVirtualNetworkName: hubVirtualNetworkName
    remoteVirtualNetworkId: ustpVirtualNetwork.id
    peeringName: 'peer-${hubVirtualNetworkName}-to-${virtualNetworkName}'
  }
}

module ustpWebapp 'frontend-webapp-deploy.bicep' = {
    name: '${stackName}-webapp-module'
    scope: resourceGroup(appResourceGroup)
    params: {
      deployAppInsights: deployAppInsights
      analyticsWorkspaceId: deployAppInsights ? analyticsWorkspaceId : ''
      planName: 'plan-${webappName}'
      planType: webappPlanType
      webappName: webappName
      stackName: stackName
      location: location
      virtualNetworkResourceGroupName: networkResourceGroupName
      createAlerts: createAlerts
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: analyticsResourceGroupName
      targetApiServerHost: '${apiFunctionName}.azurewebsites.us ${apiFunctionName}-${slotName}.azurewebsites.us' //adding both production and slot hostname to CSP
      ustpIssueCollectorHash: ustpIssueCollectorHash
      webappSubnetId: webappSubnetExisting.id
      privateEndpointSubnetId: privateEndpointSubnetExisting.id
      appServiceRuntime: 'php'
      privateDnsZoneName: privateDnsZoneName
      privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
      privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
      oktaUrl: oktaUrl
      slotName: slotName
      isUstpDeployment: isUstpDeployment
      dataflowsAppInsightsId: deployAppInsights ? ustpDataflowsFunction.outputs.appInsightsId : ''
      nodeApiAppInsightsId: deployAppInsights ? ustpApiFunction.outputs.appInsightsId : ''
      tags: webappTags
    }
}

module acsEmail './lib/email/acs-email.bicep' = {
  name: '${stackName}-acs-email-module'
  params: {
    stackName: stackName
    kvAppConfigName: kvAppConfigName
    kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
    customDomain: customDomain
    tags: {
      app: 'cams'
      component: 'email'
      'deployed-at': deployedAt
    }
  }
}

module ustpApiFunction 'backend-api-deploy.bicep' = {
    name: '${stackName}-function-module'
    scope: resourceGroup(appResourceGroup)
    dependsOn: [acsEmail]
    params: {
      stackName: stackName
      deployAppInsights: deployAppInsights
      analyticsWorkspaceId: deployAppInsights ? analyticsWorkspaceId : ''
      location: location
      apiPlanName: apiFunctionPlanName
      functionsPlanType: functionsPlanType
      apiFunctionName: apiFunctionName
      slotName: slotName
      apiFunctionSubnetId: apiFunctionSubnetExisting.id
      functionsRuntime: 'node'
      sqlServerName: sqlServerName
      sqlServerResourceGroupName: sqlServerResourceGroupName
      sqlServerIdentityName: sqlServerIdentityName
      sqlServerIdentityResourceGroupName: sqlServerIdentityResourceGroupName
      sqlServerIdentitySubscriptionId: sqlServerIdentitySubscriptionId
      apiCorsAllowOrigins: ['https://${webappName}.azurewebsites.us','https://portal.azure.us']
      apiSlotCorsAllowOrigins: ['https://${webappName}-${slotName}.azurewebsites.us','https://portal.azure.us']
      idKeyvaultAppConfiguration: idKeyvaultAppConfiguration
      kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
      virtualNetworkResourceGroupName: networkResourceGroupName
      privateEndpointSubnetId: privateEndpointSubnetExisting.id
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: analyticsResourceGroupName
      createAlerts: createAlerts
      privateDnsZoneName: privateDnsZoneName
      privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
      privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
      useSqlPrivateLink: useSqlPrivateLink
      sqlPrivateDnsZoneName: sqlPrivateDnsZoneName
      loginProviderConfig: loginProviderConfig
      loginProvider: loginProvider
      cosmosDatabaseName: cosmosDatabaseName
      e2eDatabaseName: e2eDatabaseName
      kvAppConfigName: kvAppConfigName
      isUstpDeployment: isUstpDeployment
      mssqlRequestTimeout: mssqlRequestTimeout
      maxObjectDepth: maxObjectDepth
      maxObjectKeyCount: maxObjectKeyCount
      defaultNotificationRecipient: defaultNotificationRecipient
      gitSha: gitSha
      dataflowsStorageConnectionString: ustpDataflowsFunction.outputs.dataflowsStorageConnectionString
      dataflowsSlotStorageConnectionString: ustpDataflowsFunction.outputs.dataflowsSlotStorageConnectionString
      tags: apiTags
    }
}

module ustpDataflowsFunction 'dataflows-resource-deploy.bicep' = {
  name: '${stackName}-dataflows-module'
  scope: resourceGroup(appResourceGroup)
  params: {
    stackName: stackName
    deployAppInsights: deployAppInsights
    analyticsWorkspaceId: deployAppInsights ? analyticsWorkspaceId : ''
    location: location
    dataflowsPlanName: dataflowsFunctionPlanName
    functionsPlanType: functionsPlanType
    apiFunctionName: apiFunctionName
    dataflowsFunctionName: dataflowsFunctionName
    slotName: slotName
    dataflowsFunctionSubnetId: dataflowsFunctionSubnetExisting.id
    functionsRuntime: 'node'
    sqlServerName: sqlServerName
    sqlServerResourceGroupName: sqlServerResourceGroupName
    sqlServerIdentityName: sqlServerIdentityName
    sqlServerIdentityResourceGroupName: sqlServerIdentityResourceGroupName
    sqlServerIdentitySubscriptionId: sqlServerIdentitySubscriptionId
    dataflowsCorsAllowOrigins: ['https://portal.azure.us']
    idKeyvaultAppConfiguration: idKeyvaultAppConfiguration
    kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
    virtualNetworkResourceGroupName: networkResourceGroupName
    privateEndpointSubnetId: privateEndpointSubnetExisting.id
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: analyticsResourceGroupName
    createAlerts: createAlerts
    privateDnsZoneName: privateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    useSqlPrivateLink: useSqlPrivateLink
    sqlPrivateDnsZoneName: sqlPrivateDnsZoneName
    loginProviderConfig: loginProviderConfig
    loginProvider: loginProvider
    cosmosDatabaseName: cosmosDatabaseName
    e2eDatabaseName: e2eDatabaseName
    e2eSqlDatabaseName: e2eSqlDatabaseName
    kvAppConfigName: kvAppConfigName
    isUstpDeployment: isUstpDeployment
    mssqlRequestTimeout: mssqlRequestTimeout
    enabledDataflows: enabledDataflows
    migrateCaseAppointmentsFetchSize: migrateCaseAppointmentsFetchSize
    objectContainerName: objectContainerName
    gitSha: gitSha
    tags: dataflowsTags
  }
}
