param location string = resourceGroup().location

@description('Application service plan name')
param planName string

@description('Plan type to determine plan Sku')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param planType string = 'P1v2'

var planTypeToSkuMap = {
  P1v2: {
    name: 'P1v2'
    tier: 'PremiumV2'
    size: 'P1v2'
    family: 'Pv2'
    capacity: 1
  }
  B2: {
    name: 'B2'
    tier: 'Basic'
    size: 'B2'
    family: 'B'
    capacity: 1
  }
  S1: {
    name: 'S1'
    tier: 'Standard'
    size: 'S1'
    family: 'S'
    capacity: 1
  }
}

@description('Azure functions app name')
param functionName string

@description('Existing Private DNS Zone used for application')
param privateDnsZoneName string

@description('Existing virtual network name')
param virtualNetworkName string

@description('Resource group name of target virtual network')
param virtualNetworkResourceGroupName string

@description('Backend Azure Functions subnet name')
param functionSubnetName string

@description('Backend Azure Functions subnet ip ranges')
param functionsSubnetAddressPrefix string

@description('Backend private endpoint subnet name')
param privateEndpointSubnetName string

@description('Backend private endpoint subnet ip ranges')
param privateEndpointSubnetAddressPrefix string

@description('Azure functions runtime environment')
@allowed([
  'java'
  'node'
])
param functionsRuntime string

// Provides mapping for runtime stack
// Use the following query to check supported versions
//  az functionapp list-runtimes --os linux --query "[].{stack:join(' ', [runtime, version]), LinuxFxVersion:linux_fx_version, SupportedFunctionsVersions:to_string(supported_functions_versions[])}" --output table
var linuxFxVersionMap = {
  java: 'JAVA|17'
  node: 'NODE|18'
}

@description('Azure functions version')
param functionsVersion string = '~4'

@description('Storage account name. Default creates unique name from resource group id and stack name')
@minLength(3)
@maxLength(24)
param functionsStorageName string = 'ustpfunc${uniqueString(resourceGroup().id, functionName)}'

@description('List of origins to allow. Need to include protocol')
param corsAllowOrigins array = []

@description('Database connection string')
@secure()
param databaseConnectionString string = ''

@description('Resource group name of database server')
param sqlServerResourceGroupName string = ''

@description('Name for managed identity of database server')
param sqlServerIdentityName string = ''

@description('Resource group name for managed identity of database server')
param sqlServerIdentityResourceGroupName string = ''

@description('Resource group name of the app config KeyVault')
param kvAppConfigResourceGroupName string = ''

@description('Database server name')
param sqlServerName string = ''

@description('Flag to enable Vercode access')
param allowVeracodeScan bool = false

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

@description('Action Group Name for alerts')
param actionGroupName string

@description('Action Group Resource Group Name for alerts')
param actionGroupResourceGroupName string

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool

@description('Name of the managed identity with read access to the keyvault storing application configurations.')
@secure()
param idKeyvaultAppConfiguration string

resource appConfigIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: idKeyvaultAppConfiguration
  scope: resourceGroup(kvAppConfigResourceGroupName)
}

/*
  App service plan (hosting plan) for Azure functions instances
*/
resource servicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  location: location
  name: planName
  sku: planTypeToSkuMap[planType]
  kind: 'linux'
  properties: {
    perSiteScaling: false
    elasticScaleEnabled: false
    maximumElasticWorkerCount: 1
    isSpot: false
    reserved: true // set true for Linux
    isXenon: false
    hyperV: false
    targetWorkerCount: 0
    targetWorkerSizeId: 0
    zoneRedundant: false
  }
}

/*
  Subnet creation in target virtual network
*/
module subnet './lib/network/subnet.bicep' = {
  name: '${functionName}-subnet-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    virtualNetworkName: virtualNetworkName
    subnetName: functionSubnetName
    subnetAddressPrefix: functionsSubnetAddressPrefix
    subnetServiceEndpoints: [
      {
        service: 'Microsoft.Sql'
        locations: [
          location
        ]
      }
      {
        service: 'Microsoft.AzureCosmosDB'
        locations: [
          location
        ]
      }
    ]
    subnetDelegations: [
      {
        name: 'Microsoft.Web/serverfarms'
        properties: {
          serviceName: 'Microsoft.Web/serverfarms'
        }
      }
    ]
  }
}

/*
  Private endpoint creation in target virtual network.
*/
module privateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${functionName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites'
    stackName: functionName
    location: location
    virtualNetworkName: virtualNetworkName
    privateDnsZoneName: privateDnsZoneName
    privateEndpointSubnetName: privateEndpointSubnetName
    privateEndpointSubnetAddressPrefix: privateEndpointSubnetAddressPrefix
    privateLinkServiceId: functionApp.id
  }
}
/*
  Storage resource for Azure functions
*/
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: functionsStorageName
  location: location
  tags: {
    'Stack Name': functionName
  }
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'Storage'
  properties: {
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)
module appInsights './lib/app-insights/app-insights.bicep' = if (createApplicationInsights) {
  name: '${functionName}-application-insights-module'
  params: {
    location: location
    kind: 'web'
    appInsightsName: 'appi-${functionName}'
    applicationType: 'web'
    workspaceResourceId: analyticsWorkspaceId
  }
}

module diagnosticSettings './lib/app-insights/diagnostics-settings-func.bicep' = {
  name: '${functionName}-diagnostic-settings-module'
  params: {
    functionAppName: functionName
    workspaceResourceId: analyticsWorkspaceId
  }
  dependsOn: [
    appInsights
    functionApp
  ]
}
module healthAlertRule './lib/monitoring-alerts/metrics-alert-rule.bicep' = if (createAlerts) {
  name: '${functionName}-healthcheck-alert-rule-module'
  params: {
    alertName: '${functionName}-health-check-alert'
    appId: functionApp.id
    timeAggregation: 'Average'
    operator: 'LessThan'
    targetResourceType: 'Microsoft.Web/sites'
    metricName: 'HealthCheckStatus'
    severity: 2
    threshold: 100
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
  }
}
module httpAlertRule './lib/monitoring-alerts/metrics-alert-rule.bicep' = if (createAlerts) {
  name: '${functionName}-http-error-alert-rule-module'
  params: {
    alertName: '${functionName}-http-error-alert'
    appId: functionApp.id
    timeAggregation: 'Total'
    operator: 'GreaterThanOrEqual'
    targetResourceType: 'Microsoft.Web/sites'
    metricName: 'Http5xx'
    severity: 1
    threshold: 1
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
  }
}

/*
  Create functionapp
*/
var userAssignedIdentities = union(
  {
    '${appConfigIdentity.id}': {}
  }, createSqlServerVnetRule ? { '${sqlIdentity.id}': {} } : {}
)
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: userAssignedIdentities
  }
  properties: {
    serverFarmId: servicePlan.id
    enabled: true
    httpsOnly: true
    virtualNetworkSubnetId: subnet.outputs.subnetId
    keyVaultReferenceIdentity: appConfigIdentity.id
  }
  dependsOn: [
    appConfigIdentity
    sqlIdentity
  ]
}
var applicationSettings = concat([
    {
      name: 'AzureWebJobsStorage'
      value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
    }
    {
      name: 'FUNCTIONS_EXTENSION_VERSION'
      value: functionsVersion
    }
    {
      name: 'FUNCTIONS_WORKER_RUNTIME'
      value: functionsRuntime
    }
  ],
  !empty(databaseConnectionString) ? [ { name: 'SQL_SERVER_CONN_STRING', value: databaseConnectionString } ] : [],
  createApplicationInsights ? [ { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.outputs.connectionString } ] : []
)
var ipSecurityRestrictionsRules = concat([ {
      ipAddress: 'Any'
      action: 'Deny'
      priority: 2147483647
      name: 'Deny all'
      description: 'Deny all access'
    } ],
  allowVeracodeScan ? [ {
      ipAddress: '3.32.105.199/32'
      action: 'Allow'
      priority: 1000
      name: 'Veracode Agent'
      description: 'Allow Veracode DAST Scans'
    } ] : [])
resource functionAppConfig 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: functionApp
  name: 'web'
  properties: {
    cors: {
      allowedOrigins: corsAllowOrigins
    }
    numberOfWorkers: 1
    alwaysOn: true
    http20Enabled: true
    functionAppScaleLimit: 0
    minimumElasticInstanceCount: 0
    publicNetworkAccess: 'Enabled'
    ipSecurityRestrictions: ipSecurityRestrictionsRules
    ipSecurityRestrictionsDefaultAction: 'Deny'
    scmIpSecurityRestrictions: [
      {
        ipAddress: 'Any'
        action: 'Deny'
        priority: 2147483647
        name: 'Deny all'
        description: 'Deny all access'
      }
    ]
    scmIpSecurityRestrictionsDefaultAction: 'Deny'
    scmIpSecurityRestrictionsUseMain: false
    linuxFxVersion: linuxFxVersionMap['${functionsRuntime}']
    appSettings: applicationSettings
  }
}
var createSqlServerVnetRule = !empty(sqlServerResourceGroupName) && !empty(sqlServerName)
module setSqlServerVnetRule './lib/sql/sql-vnet-rule.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlServerResourceGroupName)
  name: '${functionName}-sql-vnet-rule-module'
  params: {
    stackName: functionName
    sqlServerName: sqlServerName
    subnetId: subnet.outputs.subnetId
  }
}

// Creates a managed identity that would be used to grant access to functionapp instance
var sqlIdentityName = !empty(sqlServerIdentityName) ? sqlServerIdentityName : 'id-sql-${functionName}-readonly'
var sqlIdentityRG = !empty(sqlServerIdentityResourceGroupName) ? sqlServerIdentityResourceGroupName : sqlServerResourceGroupName
module sqlManagedIdentity './lib/identity/managed-identity.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlIdentityRG)
  name: '${functionName}-sql-identity-module'
  params: {
    managedIdentityName: sqlIdentityName
    location: location
  }
}
resource sqlIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: sqlIdentityName
  scope: resourceGroup(sqlIdentityRG)
}

output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output createdSqlServerVnetRule bool = createSqlServerVnetRule
output keyVaultId string = functionApp.properties.keyVaultReferenceIdentity
