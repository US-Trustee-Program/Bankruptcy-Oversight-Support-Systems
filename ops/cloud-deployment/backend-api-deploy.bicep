param location string = resourceGroup().location

@description('Application service plan name')
param apiPlanName string

param stackName string = 'ustp-cams'

@description('Azure functions version')
param functionsVersion string = '~4'

@description('Storage account name. Default creates unique name from resource group id and stack name')
@minLength(3)
@maxLength(24)
param apiFunctionStorageName string = 'ustpfunc${uniqueString(resourceGroup().id, apiFunctionName)}'
@description('Slot storage account name. Default creates unique name from resource group id and stack name')
@minLength(3)
@maxLength(24)
param apiFunctionSlotStorageName string = 'ustpslot${uniqueString(resourceGroup().id, apiFunctionName)}'

param apiFunctionName string
param slotName string

param apiFunctionSubnetId string

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
param apiCorsAllowOrigins array = []
@description('List of origins to allow on the API non-production deployment slot. Need to include protocol')
param apiSlotCorsAllowOrigins array = []

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

param privateDnsZoneName string = 'privatelink.azurewebsites.us'

param privateDnsZoneResourceGroup string = virtualNetworkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

param maxObjectDepth string

param maxObjectKeyCount string

param gitSha string

param dataflowsStorageConnectionString string

param dataflowsSlotStorageConnectionString string

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)

resource appConfigIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: idKeyvaultAppConfiguration
  scope: resourceGroup(kvAppConfigResourceGroupName)
}

resource apiServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  location: location
  name: apiPlanName
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
    targetWorkerCount: 1
    targetWorkerSizeId: 1
    zoneRedundant: false
  }
}


resource apiFunctionStorageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: apiFunctionStorageName
  location: location
  tags: {
    'Stack Name': apiFunctionName
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

resource apiFunctionSlotStorageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: apiFunctionSlotStorageName
  location: location
  tags: {
    'Stack Name': apiFunctionName
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

var userAssignedIdentities = union(
  {
    '${appConfigIdentity.id}': {}
  },
  createSqlServerVnetRule ? { '${sqlIdentity.id}': {} } : {}
)

resource apiFunctionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: apiFunctionName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: userAssignedIdentities
  }
  properties: {
    serverFarmId: apiServicePlan.id
    enabled: true
    httpsOnly: true
    virtualNetworkSubnetId: apiFunctionSubnetId
    keyVaultReferenceIdentity: appConfigIdentity.id
  }
  dependsOn: [
    appConfigIdentity
    sqlIdentity
  ]

  resource apiFunctionConfig 'config' = {
    name: 'web'
    properties: prodFunctionAppConfigProperties
  }

  resource slotConfigNames 'config' = {
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
    resource apiFunctionConfig 'config' = {
      name: 'web'
      properties: slotFunctionAppConfigProperties
    }

    properties: {
      serverFarmId: apiFunctionApp.properties.serverFarmId
      enabled: apiFunctionApp.properties.enabled
      httpsOnly: apiFunctionApp.properties.httpsOnly
      virtualNetworkSubnetId: apiFunctionApp.properties.virtualNetworkSubnetId
      keyVaultReferenceIdentity: apiFunctionApp.properties.keyVaultReferenceIdentity
    }
  }
}

var baseApiFunctionAppConfigProperties = {
    numberOfWorkers: 1
    alwaysOn: true
    http20Enabled: true
    functionAppScaleLimit: 1
    minimumElasticInstanceCount: 1
    publicNetworkAccess: 'Enabled'
    ipSecurityRestrictionsDefaultAction: isUstpDeployment ? 'Deny' : 'Allow'
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
    appSettings: apiApplicationSettings
    ftpsState: 'Disabled'
  }

  var prodFunctionAppConfigProperties = union(baseApiFunctionAppConfigProperties, {
    ipSecurityRestrictions: productionIpSecurityRestrictionsRules
    appSettings: concat(baseApiFunctionAppConfigProperties.appSettings, [
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
        value: 'DefaultEndpointsProtocol=https;AccountName=${apiFunctionStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${apiFunctionStorageAccount.listKeys().keys[0].value}'
      }
      {
        name: 'AzureWebJobsDataflowsStorage'
        value: dataflowsStorageConnectionString
      }
    ])
    cors: {
      allowedOrigins: apiCorsAllowOrigins
    }
  })

  var slotFunctionAppConfigProperties = union(baseApiFunctionAppConfigProperties, {
    ipSecurityRestrictions: stagingIpSecurityRestrictionsRules
    ipSecurityRestrictionsDefaultAction: 'Deny'
    appSettings: concat(baseApiFunctionAppConfigProperties.appSettings, [
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
        value: 'DefaultEndpointsProtocol=https;AccountName=${apiFunctionSlotStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${apiFunctionSlotStorageAccount.listKeys().keys[0].value}'
      }
      {
        name: 'AzureWebJobsDataflowsStorage'
        value: dataflowsSlotStorageConnectionString
      }
    ])
    cors: {
      allowedOrigins: apiSlotCorsAllowOrigins
    }
  })

module apiFunctionAppInsights 'lib/app-insights/function-app-insights.bicep' = {
  name: 'appi-${apiFunctionName}-module'
  scope: resourceGroup()
  params: {
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
    analyticsWorkspaceId: analyticsWorkspaceId
    createAlerts: createAlerts
    createApplicationInsights: createApplicationInsights
    functionAppName: apiFunctionName
  }
  dependsOn: [
    apiFunctionApp
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
      name: 'MAX_OBJECT_DEPTH'
      value: maxObjectDepth
    }
    {
      name: 'MAX_OBJECT_KEY_COUNT'
      value: maxObjectKeyCount
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
        { name: 'MSSQL_PASS', value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-CLIENT-ID)' }
        {
          name: 'ACMS_MSSQL_CLIENT_ID'
          value: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-CLIENT-ID)'
        }
      ]
)

var apiApplicationSettings = concat(
  baseApplicationSettings,
  createApplicationInsights
    ? [{ name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: apiFunctionAppInsights.outputs.connectionString }]
    : []
)

var productionIpSecurityRestrictionsRules = isUstpDeployment
  ? [
      {
        ipAddress: 'Any'
        action: 'Deny'
        priority: 2147483647
        name: 'Deny all'
        description: 'Deny all access'
      }
    ]
  : []

var stagingIpSecurityRestrictionsRules = [
  {
    ipAddress: 'Any'
    action: 'Deny'
    priority: 2147483647
    name: 'Deny all'
    description: 'Deny all access'
  }
]

module apiPrivateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${apiFunctionName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites'
    stackName: apiFunctionName
    location: location
    privateLinkServiceId: apiFunctionApp.id
    privateEndpointSubnetId: privateEndpointSubnetId
    privateDnsZoneName: privateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
  }
}

module apiSlotPrivateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${apiFunctionName}-${slotName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites-${slotName}'
    stackName: 'stg-${apiFunctionName}'
    dnsZoneGroupName: isUstpDeployment ? 'zone-group' : 'default'
    location: location
    privateLinkServiceId: apiFunctionApp.id
    privateEndpointSubnetId: privateEndpointSubnetId
    privateDnsZoneName: privateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
  }
  dependsOn: [
    apiFunctionApp::slot
  ]
}


var createSqlServerVnetRule = !empty(sqlServerResourceGroupName) && !empty(sqlServerName) && !isUstpDeployment

module setApiFunctionSqlServerVnetRule './lib/network/sql-vnet-rule.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlServerResourceGroupName)
  name: '${apiFunctionName}-sql-vnet-rule-module'
  params: {
    stackName: apiFunctionName
    sqlServerName: sqlServerName
    subnetId: apiFunctionSubnetId
  }
}

var sqlIdentityName = !empty(sqlServerIdentityName) ? sqlServerIdentityName : 'id-sql-${apiFunctionName}-readonly'
var sqlIdentityRG = !empty(sqlServerIdentityResourceGroupName)
  ? sqlServerIdentityResourceGroupName
  : sqlServerResourceGroupName

module sqlManagedIdentity './lib/identity/managed-identity.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlIdentityRG)
  name: '${apiFunctionName}-sql-identity-module'
  params: {
    managedIdentityName: sqlIdentityName
    location: location
  }
}

resource sqlIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: sqlIdentityName
  scope: resourceGroup(sqlIdentityRG)
}
