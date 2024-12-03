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

param stackName string = 'ustp-cams'

param functionName string

param virtualNetworkResourceGroupName string

param functionSubnetId string

param privateEndpointSubnetId string

param mssqlRequestTimeout string

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
  node: 'NODE|20'
}

param loginProviderConfig string

param loginProvider string

@description('Is ustp deployment')
param isUstpDeployment bool

@description('Azure functions version')
param functionsVersion string = '~4'

@description('Storage account name. Default creates unique name from resource group id and stack name')
@minLength(3)
@maxLength(24)
param functionsStorageName string = 'ustpfunc${uniqueString(resourceGroup().id, functionName)}'

@description('List of origins to allow. Need to include protocol')
param corsAllowOrigins array = []

param sqlServerResourceGroupName string = ''

param sqlServerIdentityName string = ''

param sqlServerIdentityResourceGroupName string = ''

@description('Resource group name of the app config KeyVault')
param kvAppConfigResourceGroupName string = ''

@description('name of the app config KeyVault')
param kvAppConfigName string = 'kv-${stackName}'

param sqlServerName string = ''

@description('Flag to enable Vercode access')
param allowVeracodeScan bool = false

@description('Name of the managed identity with read access to the keyvault storing application configurations.')
@secure()
param idKeyvaultAppConfiguration string

param cosmosDatabaseName string

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

param actionGroupName string = ''

param actionGroupResourceGroupName string = ''

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

param privateDnsZoneName string = 'privatelink.azurewebsites.net'

param privateDnsZoneResourceGroup string = virtualNetworkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)

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

module diagnosticSettings './lib/app-insights/diagnostics-settings-func.bicep' = if (createApplicationInsights) {
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
  },
  createSqlServerVnetRule ? { '${sqlIdentity.id}': {} } : {}
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
    virtualNetworkSubnetId: functionSubnetId
    keyVaultReferenceIdentity: appConfigIdentity.id
  }
  dependsOn: [
    appConfigIdentity
    sqlIdentity
  ]
}

//TODO: Clear segregation with DXTR vs ACMS variable/secret naming in GitHub and ADO secret libraries

var applicationSettings = concat(
  [
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
    {
      name: 'CAMS_LOGIN_PROVIDER_CONFIG'
      value: loginProviderConfig
    }
    {
      name: 'CAMS_LOGIN_PROVIDER'
      value: loginProvider
    }
    {
      name: 'STARTING_MONTH'
      value: '-70'
    }
    {
      name: 'COSMOS_DATABASE_NAME'
      value: cosmosDatabaseName
    }
    {
      name: 'MONGO_CONNECTION_STRING'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MONGO-CONNECTION-STRING)'
    }
    {
      name: 'INFO_SHA'
      value: 'ProductionSlot'
    }
    {
      name: 'WEBSITE_RUN_FROM_PACKAGE'
      value: '1'
    }
    {
      name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
      value: false
    }
    {
      name: 'MSSQL_HOST'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-HOST)'
    }
    {
      name: 'MSSQL_DATABASE_DXTR'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-DATABASE-DXTR)'
    }
    {
      name: 'MSSQL_CLIENT_ID'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-CLIENT-ID)'
    }
    {
      name: 'MSSQL_ENCRYPT'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-ENCRYPT)'
    }
    {
      name: 'MSSQL_TRUST_UNSIGNED_CERT'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-TRUST-UNSIGNED-CERT)'
    }
    {
      name: 'MSSQL_REQUEST_TIMEOUT'
      value: mssqlRequestTimeout
    }
    {
      name: 'ACMS_MSSQL_HOST'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-HOST)'
    }
    {
      name: 'ACMS_MSSQL_DATABASE'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-DATABASE)'
    }
    {
      name: 'ACMS_MSSQL_ENCRYPT'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-ENCRYPT)'
    }
    {
      name: 'ACMS_MSSQL_TRUST_UNSIGNED_CERT'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-TRUST-UNSIGNED-CERT)'
    }
    {
      name: 'ACMS_MSSQL_REQUEST_TIMEOUT'
      value: mssqlRequestTimeout
    }
    {
      name: 'FEATURE_FLAG_SDK_KEY'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=FEATURE-FLAG-SDK-KEY)'
    }
    {
      name: 'CAMS_USER_GROUP_GATEWAY_CONFIG'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=CAMS-USER-GROUP-GATEWAY-CONFIG)'
    }
    {
      name: 'OKTA_API_KEY'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=OKTA-API-KEY)'
    }
    {
      name: 'TaskHubName'
      value: 'main'
    }
  ],
  createApplicationInsights
    ? [{ name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.outputs.connectionString }]
    : [],
  isUstpDeployment
    ? [
        { name: 'MSSQL_USER', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-USER)' }
        { name: 'MSSQL_PASS', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-PASS)' }
        { name: 'ACMS_MSSQL_USER', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-USER)' }
        { name: 'ACMS_MSSQL_PASS', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-PASS)' }
      ]
    : [
        { name: 'MSSQL_PASS', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-CLIENT-ID)' }
        { name: 'ACMS_MSSQL_CLIENT_ID', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-CLIENT-ID)'}
      ]
)

var ipSecurityRestrictionsRules = concat(
  [
    {
      ipAddress: 'Any'
      action: 'Deny'
      priority: 2147483647
      name: 'Deny all'
      description: 'Deny all access'
    }
  ],
  allowVeracodeScan
    ? [
        {
          ipAddress: '3.32.105.199/32'
          action: 'Allow'
          priority: 1000
          name: 'Veracode Agent'
          description: 'Allow Veracode DAST Scans'
        }
      ]
    : []
)

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

module privateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${functionName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites'
    stackName: functionName
    location: location
    privateLinkServiceId: functionApp.id
    privateEndpointSubnetId: privateEndpointSubnetId
    privateDnsZoneName: privateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
  }
}

var createSqlServerVnetRule = !empty(sqlServerResourceGroupName) && !empty(sqlServerName) && !isUstpDeployment

module setSqlServerVnetRule './lib/network/sql-vnet-rule.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlServerResourceGroupName)
  name: '${functionName}-sql-vnet-rule-module'
  params: {
    stackName: functionName
    sqlServerName: sqlServerName
    subnetId: functionSubnetId
  }
}

// Creates a managed identity that would be used to grant access to functionapp instance
var sqlIdentityName = !empty(sqlServerIdentityName) ? sqlServerIdentityName : 'id-sql-${functionName}-readonly'
var sqlIdentityRG = !empty(sqlServerIdentityResourceGroupName)
  ? sqlServerIdentityResourceGroupName
  : sqlServerResourceGroupName

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
