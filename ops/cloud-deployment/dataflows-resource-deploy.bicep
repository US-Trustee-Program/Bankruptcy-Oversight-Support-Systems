param location string = resourceGroup().location

@description('Application service plan name')
param dataflowsPlanName string

param stackName string = 'ustp-cams'

@description('Azure functions version')
param functionsVersion string = '~4'

@description('Storage account name. Default creates unique name from resource group id and stack name')
@minLength(3)
@maxLength(24)
param dataflowsFunctionStorageName string = 'datafunc${uniqueString(resourceGroup().id, dataflowsFunctionName)}'
@description('Slot storage account name. Default creates unique name from resource group id and stack name')
@minLength(3)
@maxLength(24)
param dataflowsFunctionSlotStorageName string = 'dataslot${uniqueString(resourceGroup().id, dataflowsFunctionName)}'

param dataflowsFunctionName string

param apiFunctionName string

param slotName string

param dataflowsFunctionSubnetId string

param virtualNetworkResourceGroupName string

param privateEndpointSubnetId string

param mssqlRequestTimeout string

@description('Azure functions runtime environment')
@allowed([
  'node'
])
param functionsRuntime string

// Provides mapping for runtime stack
// Use the following query to check supported versions
//  az functionapp list-runtimes --os linux --query "[].{stack:join(' ', [runtime, version]), LinuxFxVersion:linux_fx_version, SupportedFunctionsVersions:to_string(supported_functions_versions[])}" --output table
// NOTE: Should match major version in .nvmrc (currently v22.17.1)
var linuxFxVersionMap = {
  node: 'NODE|22'
}

param loginProviderConfig string

param loginProvider string

@description('Is ustp deployment')
param isUstpDeployment bool

@description('List of origins to allow. Need to include protocol')
param dataflowsCorsAllowOrigins array = []

param sqlServerResourceGroupName string = ''

param sqlServerIdentityName string = ''

param sqlServerIdentityResourceGroupName string = ''

@description('Resource group name of the app config KeyVault')
param kvAppConfigResourceGroupName string = ''

@description('name of the app config KeyVault')
param kvAppConfigName string = 'kv-${stackName}'

param sqlServerName string = ''

@description('Name of the managed identity with read access to the keyvault storing application configurations.')
@secure()
param idKeyvaultAppConfiguration string

param cosmosDatabaseName string
param e2eDatabaseName string

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

param actionGroupName string = ''

param actionGroupResourceGroupName string = ''

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

@description('Comma delimited list of data flow names to enable.')
param enabledDataflows string

param privateDnsZoneName string = 'privatelink.azurewebsites.us'

param privateDnsZoneResourceGroup string = virtualNetworkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

param gitSha string

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)

resource appConfigIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: idKeyvaultAppConfiguration
  scope: resourceGroup(kvAppConfigResourceGroupName)
}

resource dataflowsServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  location: location
  name: dataflowsPlanName
  sku: {
    name: 'EP1'
    tier: 'ElasticPremium'
    family: 'EP'
  }
  kind: 'elastic'
  properties: {
    perSiteScaling: true
    elasticScaleEnabled: true
    maximumElasticWorkerCount: 10
    isSpot: false
    reserved: true // set true for Linux
    isXenon: false
    hyperV: false
    targetWorkerCount: 0
    targetWorkerSizeId: 0
    zoneRedundant: false
  }
}

//Storage Account Resources
resource dataflowsFunctionStorageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: dataflowsFunctionStorageName
  location: location
  tags: {
    'Stack Name': dataflowsFunctionName
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

resource dataflowsFunctionSlotStorageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: dataflowsFunctionSlotStorageName
  location: location
  tags: {
    'Stack Name': dataflowsFunctionName
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

module dataflowsQueues './lib/storage/storage-queues.bicep' = {
  name: 'dataflows-queues-module'
  params: {
    storageAccountName: dataflowsFunctionStorageName
  }
  dependsOn: [
    dataflowsFunctionStorageAccount
  ]
}

module dataflowsSlotQueues './lib/storage/storage-queues.bicep' = {
  name: 'dataflows-slot-queues-module'
  params: {
    storageAccountName: dataflowsFunctionSlotStorageName
  }
  dependsOn: [
    dataflowsFunctionStorageAccount
  ]
}

//Function App Resources
var userAssignedIdentities = union(
  {
    '${appConfigIdentity.id}': {}
  },
  createSqlServerVnetRule ? { '${sqlIdentity.id}': {} } : {}
)

resource dataflowsFunctionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: dataflowsFunctionName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: userAssignedIdentities
  }
  properties: {
    serverFarmId: dataflowsServicePlan.id
    enabled: true
    httpsOnly: true
    virtualNetworkSubnetId: dataflowsFunctionSubnetId
    keyVaultReferenceIdentity: appConfigIdentity.id
  }
  resource dataflowsFunctionConfig 'config' = {
    name: 'web'
    properties: union(dataflowsFunctionConfigProperties, {
      appSettings: concat(dataflowsFunctionConfigProperties.appSettings, [
        {
          name: 'INFO_SHA'
          value: 'ProductionSlot'
        }
        {
          name: 'MyTaskHub'
          value: 'main'
        }
        {
          name: 'COSMOS_DATABASE_NAME'
          value: cosmosDatabaseName
        }
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${dataflowsFunctionStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${dataflowsFunctionStorageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'AzureWebJobsDataflowsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${dataflowsFunctionStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${dataflowsFunctionStorageAccount.listKeys().keys[0].value}'
        }
      ])
    })
  }
  dependsOn: [
    appConfigIdentity
    sqlIdentity
  ]

  resource slotConfigName 'config' = {
    name: 'slotConfigNames'
    properties: {
      appSettingNames: [
        'AzureWebJobsStorage'
        'AzureWebJobsDataflowsStorage'
        'MyTaskHub'
        'COSMOS_DATABASE_NAME'
      ]
    }
  }

  resource slot 'slots' = {
    location: location
    name: slotName
    identity: {
      type: 'UserAssigned'
      userAssignedIdentities: userAssignedIdentities
    }
    properties: {
      serverFarmId: dataflowsFunctionApp.properties.serverFarmId
      enabled: dataflowsFunctionApp.properties.enabled
      httpsOnly: dataflowsFunctionApp.properties.httpsOnly
      virtualNetworkSubnetId: dataflowsFunctionApp.properties.virtualNetworkSubnetId
      keyVaultReferenceIdentity: dataflowsFunctionApp.properties.keyVaultReferenceIdentity
    }
    resource dataflowsFunctionConfig 'config' = {
      name: 'web'
      properties: union(dataflowsFunctionConfigProperties, {
        appSettings: concat(dataflowsFunctionConfigProperties.appSettings, [
          {
            name: 'INFO_SHA'
            value: gitSha
          }
          {
            name: 'MyTaskHub'
            value: slotName
          }
          {
            name: 'COSMOS_DATABASE_NAME'
            value: e2eDatabaseName
          }
          {
            name: 'AzureWebJobsStorage'
            value: 'DefaultEndpointsProtocol=https;AccountName=${dataflowsFunctionSlotStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${dataflowsFunctionSlotStorageAccount.listKeys().keys[0].value}'
          }
          {
            name: 'AzureWebJobsDataflowsStorage'
            value: 'DefaultEndpointsProtocol=https;AccountName=${dataflowsFunctionSlotStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${dataflowsFunctionSlotStorageAccount.listKeys().keys[0].value}'
          }
        ])
      })
    }
  }
}

var dataflowsFunctionConfigProperties = {
    cors: {
      allowedOrigins: dataflowsCorsAllowOrigins
    }
    numberOfWorkers: 4
    alwaysOn: false
    http20Enabled: true
    functionAppScaleLimit: 4
    minimumElasticInstanceCount: 1
    publicNetworkAccess: 'Enabled'
    ipSecurityRestrictions: dataflowsIpSecurityRestrictionsRules
    ipSecurityRestrictionsDefaultAction: 'Deny'
    scmIpSecurityRestrictions: concat(
      [
        {
          ipAddress: 'Any'
          action: 'Deny'
          priority: 2147483647
          name: 'Deny all'
          description: 'Deny all access'
        }
      ],
      middlewareIpSecurityRestrictionsRules
    )
    scmIpSecurityRestrictionsDefaultAction: 'Deny'
    scmIpSecurityRestrictionsUseMain: false
    linuxFxVersion: linuxFxVersionMap['${functionsRuntime}']
    appSettings: dataflowsApplicationSettings
    ftpsState: 'Disabled'
  }

//Create App Insights

module dataflowsFunctionAppInsights 'lib/app-insights/function-app-insights.bicep' = {
  name: 'appi-${dataflowsFunctionName}-module'
  scope: resourceGroup()
  params: {
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
    analyticsWorkspaceId: analyticsWorkspaceId
    createAlerts: createAlerts
    createApplicationInsights: createApplicationInsights
    functionAppName: dataflowsFunctionName
  }
  dependsOn: [
    dataflowsFunctionApp
  ]
}

//TODO: Clear segregation with DXTR vs ACMS variable/secret naming in GitHub and ADO secret libraries

var baseApplicationSettings = concat(
  [
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
      name: 'ADMIN_KEY'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ADMIN-KEY)'
    }
    {
      name: 'MONGO_CONNECTION_STRING'
      value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MONGO-CONNECTION-STRING)'
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
      name: 'CAMS_ENABLED_DATAFLOWS'
      value: enabledDataflows
    }
  ],
  isUstpDeployment
    ? [
        { name: 'MSSQL_USER', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-USER)' }
        { name: 'MSSQL_PASS', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-PASS)' }
        {
          name: 'ACMS_MSSQL_USER'
          value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-USER)'
        }
        {
          name: 'ACMS_MSSQL_PASS'
          value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-PASS)'
        }
      ]
    : [
        { name: 'MSSQL_PASS', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-PASS)' }
        {
          name: 'ACMS_MSSQL_CLIENT_ID'
          value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-CLIENT-ID)'
        }
      ]
)

//Data Flows Function Application Settings
var dataflowsApplicationSettings = concat(
  baseApplicationSettings,
  createApplicationInsights
    ? [{ name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: dataflowsFunctionAppInsights.outputs.connectionString }]
    : []
)

var ipSecurityRestrictionsRules = [
  {
    ipAddress: 'Any'
    action: 'Deny'
    priority: 2147483647
    name: 'Deny all'
    description: 'Deny all access'
  }
]

var middlewareIpSecurityRestrictionsRules = [
  {
    ipAddress: '52.244.134.181/32'
    action: 'Allow'
    priority: 1001
    name: 'Portal mwip 1'
    description: 'Allow Azure Portal Middleware IPs'
  }
  {
    ipAddress: '52.244.176.112/32'
    action: 'Allow'
    priority: 1002
    name: 'Portal mwip 2'
    description: 'Allow Azure Portal Middleware IPs'
  }
  {
    ipAddress: '52.247.148.42/32'
    action: 'Allow'
    priority: 1003
    name: 'Portal mwip 3'
    description: 'Allow Azure Portal Middleware IPs'
  }
  {
    ipAddress: '52.247.163.6/32'
    action: 'Allow'
    priority: 1004
    name: 'Portal mwip 4'
    description: 'Allow Azure Portal Middleware IPs'
  }
]

var dataflowsIpSecurityRestrictionsRules = concat(ipSecurityRestrictionsRules, middlewareIpSecurityRestrictionsRules)

//Private Endpoints

module dataflowsFunctionPrivateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${dataflowsFunctionName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites'
    stackName: dataflowsFunctionName
    location: location
    privateLinkServiceId: dataflowsFunctionApp.id
    privateEndpointSubnetId: privateEndpointSubnetId
    privateDnsZoneName: privateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
  }
}

module dataflowsSlotPrivateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${dataflowsFunctionName}-${slotName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites-${slotName}'
    stackName: 'stg-${dataflowsFunctionName}'
    dnsZoneGroupName: isUstpDeployment ? 'zone-group' : 'default'
    location: location
    privateLinkServiceId: dataflowsFunctionApp.id
    privateEndpointSubnetId: privateEndpointSubnetId
    privateDnsZoneName: privateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
  }
  dependsOn: [
    dataflowsFunctionApp::slot
  ]
}

var createSqlServerVnetRule = !empty(sqlServerResourceGroupName) && !empty(sqlServerName) && !isUstpDeployment

module setDataflowFunctionSqlServerVnetRule './lib/network/sql-vnet-rule.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlServerResourceGroupName)
  name: '${dataflowsFunctionName}-sql-vnet-rule-module'
  params: {
    stackName: dataflowsFunctionName
    sqlServerName: sqlServerName
    subnetId: dataflowsFunctionSubnetId
  }
}

// Creates a managed identity that would be used to grant access to function instance
var sqlIdentityName = !empty(sqlServerIdentityName) ? sqlServerIdentityName : 'id-sql-${apiFunctionName}-readonly'
var sqlIdentityRG = !empty(sqlServerIdentityResourceGroupName)
  ? sqlServerIdentityResourceGroupName
  : sqlServerResourceGroupName

module sqlManagedIdentity './lib/identity/managed-identity.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlIdentityRG)
  name: '${dataflowsFunctionName}-sql-identity-module'
  params: {
    managedIdentityName: sqlIdentityName
    location: location
  }
}

resource sqlIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: sqlIdentityName
  scope: resourceGroup(sqlIdentityRG)
}

//Deploy Dataflow Workbooks

module dataflowWorkbooks 'lib/workbooks/dataflow-workbooks.bicep' = if (createApplicationInsights) {
  name: '${dataflowsFunctionName}-workbooks-module'
  scope: resourceGroup()
  params: {
    location: location
    appInsightsResourceId: dataflowsFunctionAppInsights.outputs.id
  }
}

output dataflowsStorageConnectionString securestring = 'DefaultEndpointsProtocol=https;AccountName=${dataflowsFunctionStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${dataflowsFunctionStorageAccount.listKeys().keys[0].value}'
output dataflowsSlotStorageConnectionString securestring = 'DefaultEndpointsProtocol=https;AccountName=${dataflowsFunctionSlotStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${dataflowsFunctionSlotStorageAccount.listKeys().keys[0].value}'
