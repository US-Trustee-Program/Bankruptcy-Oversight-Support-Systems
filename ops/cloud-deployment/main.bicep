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

@description('Email address to notify when an ACS email delivery-failure alert fires. Leave empty to skip creating the alert.')
@secure()
param adminNotificationEmail string = ''

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

var emailTags = {
  app: 'cams'
  component: 'email'
  'deployed-at': deployedAt
}

var acsBounceAlertRuleName = '${stackName}-acs-email-bounce-alert'
var acsSendFailureAlertRuleName = '${stackName}-acs-send-failure-alert'

// customerId (a GUID) is distinct from analyticsWorkspaceId (the full ARM resource ID) --
// the bounce-poll dataflow's Logs Query SDK call needs the former, not the latter. Gated
// identically to the analyticsWorkspaceId value passed to the dataflows module below
// (deployAppInsights && !empty(analyticsWorkspaceId)), so customerId is never non-empty
// when the module actually receives an empty workspace id.
resource analyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing =
  if (deployAppInsights && !empty(analyticsWorkspaceId)) {
    name: last(split(analyticsWorkspaceId, '/'))
    scope: resourceGroup(analyticsResourceGroupName)
  }

var analyticsWorkspaceCustomerId = analyticsWorkspace.?properties.?customerId ?? ''

// GUARD (CAMS-760, GH #2749 bug shape): this module deploys into the SHARED
// analyticsResourceGroupName, but main.bicep itself is wrapped in a per-branch
// Deployment Stack for branch deploys (see azure-deploy.sh). That combination
// is exactly what deleted the shared Key Vault in GH #2749. It is safe ONLY
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
// branch (CAMS-760, Option E / Slice 2; see app-shared-setup.bicep for why).
// This template references them by the name/id strings passed in as params.
//
// This does NOT mean every module below is RG-local: the webapp/api/dataflows
// private endpoints (into the shared network RG) and the two SQL vnet-rule
// modules (into the shared SQL RG) declared in frontend-webapp-deploy.bicep,
// backend-api-deploy.bicep, and dataflows-resource-deploy.bicep are also
// cross-scope. Those are safe to leave inside this (stacked, for branches)
// template because each one is named using this branch's own stackName-derived
// value (webappName/apiFunctionName/dataflowsFunctionName, further disambiguated
// by uniqueString(subnetId) for the SQL vnet rules) — so a branch's own app
// stack owning and deleting them on teardown is the intended behavior, not the
// GH #2749 bug shape. Only resources with a FIXED, shared name (not derived
// from this branch's stackName) must live outside this stack, as the Key
// Vault and SQL managed identity do above.
//
// The webapp/api/dataflows private DNS zone's vnet link is another instance
// of that same stackName-derived shape: the zone itself (privateDnsZoneName,
// a fixed shared name) is created in app-shared-setup.bicep, but its link
// (privateDnsZoneName-vnet-link-${stackName}) is unique per branch and
// meaningless once that branch's VNet is deleted. Creating it here, inside
// this branch's stack, makes it stack-managed and self-cleaning on branch
// teardown -- matching the private-endpoint precedent above -- instead of
// requiring az-delete-branch-resources.sh to delete it by hand.
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

module ustpWebapp 'frontend-webapp-deploy.bicep' = {
    name: '${stackName}-webapp-module'
    scope: resourceGroup(appResourceGroup)
    params: {
      deployAppInsights: deployAppInsights
      analyticsWorkspaceId: deployAppInsights ? analyticsWorkspaceId : ''
      planName: 'plan-${webappName}'
      planType: webappPlanType
      webappName: webappName
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
  scope: resourceGroup(appResourceGroup)
  params: {
    stackName: stackName
    kvAppConfigName: kvAppConfigName
    kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
    customDomain: customDomain
    analyticsWorkspaceId: deployAppInsights ? analyticsWorkspaceId : ''
    tags: {
      app: 'cams'
      component: 'email'
      'deployed-at': deployedAt
    }
  }
}

module adminActionGroup './lib/monitoring-alerts/admin-notification-action-group.bicep' =
  if (!empty(adminNotificationEmail) && deployAppInsights && !empty(analyticsWorkspaceId)) {
    name: '${stackName}-admin-action-group-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      actionGroupName: '${stackName}-admin-notifications'
      adminEmail: adminNotificationEmail
      tags: emailTags
    }
  }

module acsBounceAlert './lib/monitoring-alerts/scheduled-query-alert-rule.bicep' =
  if (!empty(adminNotificationEmail) && deployAppInsights && !empty(analyticsWorkspaceId)) {
    name: '${stackName}-acs-bounce-alert-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      alertRuleName: acsBounceAlertRuleName
      logQueryScopeResourceId: analyticsWorkspaceId
      actionGroupId: adminActionGroup!.outputs.actionGroupId
      query: '''
        ACSEmailStatusUpdateOperational
        | where DeliveryStatus in ('Failed', 'Bounced', 'Quarantined', 'FilteredSpam', 'Suppressed')
        | project TimeGenerated, CorrelationId, RecipientId, DeliveryStatus
      '''
      timeAggregation: 'Count'
      threshold: 0
      operator: 'GreaterThan'
      evaluationFrequencyMinutes: 15
      // windowSize intentionally == evaluationFrequency (no overlap). Accepted low-severity
      // tradeoff: a bounce landing near a window boundary could be missed if ACS resource-log
      // ingestion delay exceeds Azure Monitor's ~4-min late-data grace period. Revisit by
      // measuring actual ingestion_time() - TimeGenerated on this table before widening.
      windowSizeMinutes: 15
      severity: 2
      alertDescription: 'One or more trustee-notification emails failed to deliver via ACS. Check the admin notification-routing page for a wrong recipient address, or search Log Analytics/application traces around the reported timestamp for the correlationId (logged as messageId in application traces) to find the trusteeId.'
    }
  }

module acsSendFailureAlert './lib/monitoring-alerts/scheduled-query-alert-rule.bicep' =
  if (!empty(adminNotificationEmail) && deployAppInsights && !empty(analyticsWorkspaceId)) {
    name: '${stackName}-acs-send-failure-alert-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      alertRuleName: acsSendFailureAlertRuleName
      logQueryScopeResourceId: analyticsWorkspaceId
      actionGroupId: adminActionGroup!.outputs.actionGroupId
      query: '''
        AppTraces
        | where Message has '[ERROR] [ACS-NOTIFICATION-GATEWAY]' or Message has '[ERROR] [TRUSTEE-CHANGE-NOTIFICATION]'
        | project TimeGenerated, Message
      '''
      timeAggregation: 'Count'
      threshold: 0
      operator: 'GreaterThan'
      evaluationFrequencyMinutes: 15
      windowSizeMinutes: 15
      severity: 2
      alertDescription: 'The API could not reach ACS or ACS rejected a trustee-notification email at send time (as opposed to a later bounce), or no mailing list was configured for the change -- so no notification was even attempted. Search Log Analytics traces around the reported timestamp for ACS-NOTIFICATION-GATEWAY or TRUSTEE-CHANGE-NOTIFICATION to see the specific failure.'
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
      apiFunctionName: apiFunctionName
      slotName: slotName
      apiFunctionSubnetId: apiFunctionSubnetExisting.id
      functionsRuntime: 'node'
      sqlServerName: sqlServerName
      sqlServerResourceGroupName: sqlServerResourceGroupName
      sqlServerIdentityName: sqlServerIdentityName
      sqlServerIdentityResourceGroupName: sqlServerIdentityResourceGroupName
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
    apiFunctionName: apiFunctionName
    dataflowsFunctionName: dataflowsFunctionName
    slotName: slotName
    dataflowsFunctionSubnetId: dataflowsFunctionSubnetExisting.id
    functionsRuntime: 'node'
    sqlServerName: sqlServerName
    sqlServerResourceGroupName: sqlServerResourceGroupName
    sqlServerIdentityName: sqlServerIdentityName
    sqlServerIdentityResourceGroupName: sqlServerIdentityResourceGroupName
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
    analyticsResourceGroupName: analyticsResourceGroupName
    analyticsWorkspaceCustomerId: analyticsWorkspaceCustomerId
    adminNotificationEmail: adminNotificationEmail
    gitSha: gitSha
    tags: dataflowsTags
  }
}
