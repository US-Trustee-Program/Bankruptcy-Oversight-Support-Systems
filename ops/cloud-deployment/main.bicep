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
param virtualNetworkName string = virtualNetworkNameFor(stackName)

param networkResourceGroupName string

@description('Flag: determines the setup of DNS Zone, Link virtual networks to zone.')
param deployDns bool = true

param privateDnsZoneName string = 'privatelink.azurewebsites.us'

param privateDnsZoneResourceGroup string = networkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

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

module actionGroup './lib/monitoring-alerts/alert-action-group.bicep' =
  if (createAlerts) {
    name: '${actionGroupName}-action-group-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      actionGroupName: actionGroupName
    }
  }

// The virtual network, subnets, and private DNS zone are deployed by network.bicep
// as a separate deployment (its own Azure Deployment Stack — CAMS-760, Option E).
// main.bicep is app-resource-group scoped and consumes those subnets via `existing`
// references, so network.bicep MUST be deployed before this template.
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

module kvSetup './ustp-cams-kv-app-config-setup.bicep' = {
  name: '${stackName}-kv-setup-module'
  params: {
    stackName: stackName
    location: location
    deployDns: deployDns
    kvResourceGroup: kvAppConfigResourceGroupName
    kvName: kvAppConfigName
    networkResourceGroup: networkResourceGroupName
    virtualNetworkName: virtualNetworkName
    privateEndpointSubnetId: privateEndpointSubnetExisting.id
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    managedIdentityName: idKeyvaultAppConfiguration
    makeRoleAssignment: !isUstpDeployment
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
  dependsOn: [kvSetup]
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
  if (!empty(adminNotificationEmail) && !empty(analyticsWorkspaceId)) {
    name: '${stackName}-admin-action-group-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      actionGroupName: '${stackName}-admin-notifications'
      adminEmail: adminNotificationEmail
      tags: emailTags
    }
  }

module acsBounceAlert './lib/monitoring-alerts/scheduled-query-alert-rule.bicep' =
  if (!empty(adminNotificationEmail) && !empty(analyticsWorkspaceId)) {
    name: '${stackName}-acs-bounce-alert-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      alertRuleName: '${stackName}-acs-email-bounce-alert'
      logQueryScopeResourceId: analyticsWorkspaceId
      actionGroupId: adminActionGroup.outputs.actionGroupId
      query: '''
        ACSEmailStatusUpdateOperational
        | where DeliveryStatus in ('Failed', 'Bounced', 'Quarantined', 'FilteredSpam', 'Suppressed')
        | project TimeGenerated, MessageId, RecipientId, DeliveryStatus
      '''
      timeAggregation: 'Count'
      threshold: 0
      operator: 'GreaterThan'
      evaluationFrequencyMinutes: 15
      windowSizeMinutes: 15
      severity: 2
      alertDescription: 'One or more trustee-notification emails failed to deliver via ACS. Check the admin notification-routing page for a wrong recipient address, or search Log Analytics traces around the reported timestamp/messageId for the trusteeId.'
      dimensions: [
        {
          name: 'MessageId'
          operator: 'Include'
          values: ['*']
        }
      ]
    }
  }

module ustpApiFunction 'backend-api-deploy.bicep' = {
    name: '${stackName}-function-module'
    scope: resourceGroup(appResourceGroup)
    dependsOn: [kvSetup, acsEmail]
    params: {
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
  dependsOn: [kvSetup]
  params: {
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
    gitSha: gitSha
    tags: dataflowsTags
  }
}
