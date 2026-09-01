import { sqlIdentityName as sqlIdentityNameFor } from './lib/naming.bicep'

param location string = resourceGroup().location

@description('Application service plan name')
param apiPlanName string

@description('SKU for the API function app plan. EP1 (Elastic Premium) is the default; S1 (Standard) is available for environments where EP1 capacity is constrained.')
@allowed([
  'EP1'
  'S1'
])
param functionsPlanType string = 'EP1'

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
// NOTE: Should match major version in .nvmrc
var linuxFxVersionMap = {
  node: 'NODE|24'
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

@description('Subscription containing the SQL managed identity; defaults to the deploying subscription.')
param sqlServerIdentitySubscriptionId string = ''

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

@description('Subscription ID that contains the action group resource group. Defaults to the deploying subscription.')
@minLength(36)
param actionGroupSubscriptionId string = subscription().subscriptionId

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

param privateDnsZoneName string = 'privatelink.azurewebsites.us'

param privateDnsZoneResourceGroup string = virtualNetworkResourceGroupName

@description('When true, this app reaches SQL through the shared Private Link hub and no sql-vnet-rule.bicep VNet rule is created for it. Required for cross-region consumers: Azure enforces same-region between a SQL server and any subnet in a virtualNetworkRules resource, which cross-region compute cannot satisfy. The hub Private Endpoint has no such restriction.')
param useSqlPrivateLink bool = false


@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

param maxObjectDepth string

param maxObjectKeyCount string

@description('Fallback email recipient for notifications when no Cosmos routing record matches')
param defaultNotificationRecipient string = ''

param gitSha string

@secure()
param dataflowsStorageConnectionString string

@secure()
param dataflowsSlotStorageConnectionString string

param tags object = {}

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)

resource appConfigIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: idKeyvaultAppConfiguration
  scope: resourceGroup(kvAppConfigResourceGroupName)
}

var functionsPlanTypeToSkuMap = {
  EP1: { name: 'EP1', tier: 'ElasticPremium', family: 'EP' }
  S1: { name: 'S1', tier: 'Standard' }
}
var isElasticFunctionsPlan = functionsPlanType == 'EP1'

resource apiServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  location: location
  name: apiPlanName
  tags: tags
  sku: functionsPlanTypeToSkuMap[functionsPlanType]
  kind: isElasticFunctionsPlan ? 'elastic' : 'linux'
  properties: union(
    {
      perSiteScaling: true
      isSpot: false
      reserved: true // set true for Linux
      isXenon: false
      hyperV: false
      targetWorkerCount: 1
      targetWorkerSizeId: 1
      zoneRedundant: false
    },
    isElasticFunctionsPlan
      ? {
          elasticScaleEnabled: true
          maximumElasticWorkerCount: 10
        }
      : {}
  )
}


module apiFunctionStorageAccount './lib/storage/storage-account.bicep' = {
  name: '${apiFunctionStorageName}-module'
  params: {
    storageAccountName: apiFunctionStorageName
    location: location
    tags: union(tags, { slot: 'production' })
  }
}

module apiFunctionSlotStorageAccount './lib/storage/storage-account.bicep' = {
  name: '${apiFunctionSlotStorageName}-module'
  params: {
    storageAccountName: apiFunctionSlotStorageName
    location: location
    tags: union(tags, { slot: 'deployment' })
  }
}

// Attached whenever this app talks to SQL at all. The identity authenticates;
// it is independent of how the network path is reached, so it must NOT be gated
// on the VNet rule -- doing that silently drops the identity for consumers that
// reach SQL through the hub, and ManagedIdentityCredential then fails at runtime
// with no compile-time signal.
var attachSqlIdentity = !empty(sqlServerResourceGroupName) && !empty(sqlServerName) && !isUstpDeployment

var userAssignedIdentities = union(
  {
    '${appConfigIdentity.id}': {}
  },
  attachSqlIdentity ? { '${sqlIdentityResourceId}': {} } : {}
)

resource apiFunctionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: apiFunctionName
  location: location
  tags: tags
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
        'MSSQL_DATABASE_DXTR'
      ]
    }
  }

  resource slot 'slots' = {
    location: location
    name: slotName
    tags: union(tags, { slot: 'deployment' })
    identity: {
      type: 'UserAssigned'
      userAssignedIdentities: userAssignedIdentities
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

// config/web and config/appsettings are deployed as separate top-level resources
// (not nested in the slot) so that ARM fully provisions the slot — including its
// internal Azure Files content share — before applying configuration.
// See dataflows-resource-deploy.bicep for full explanation.
resource apiSlotSiteConfig 'Microsoft.Web/sites/slots/config@2023-12-01' = {
  name: '${apiFunctionName}/${slotName}/web'
  properties: {
    numberOfWorkers: baseApiFunctionAppConfigProperties.numberOfWorkers
    alwaysOn: baseApiFunctionAppConfigProperties.alwaysOn
    http20Enabled: baseApiFunctionAppConfigProperties.http20Enabled
    functionAppScaleLimit: baseApiFunctionAppConfigProperties.?functionAppScaleLimit
    minimumElasticInstanceCount: baseApiFunctionAppConfigProperties.?minimumElasticInstanceCount
    publicNetworkAccess: baseApiFunctionAppConfigProperties.publicNetworkAccess
    ipSecurityRestrictions: stagingIpSecurityRestrictionsRules
    ipSecurityRestrictionsDefaultAction: 'Deny'
    scmIpSecurityRestrictions: baseApiFunctionAppConfigProperties.scmIpSecurityRestrictions
    scmIpSecurityRestrictionsDefaultAction: baseApiFunctionAppConfigProperties.scmIpSecurityRestrictionsDefaultAction
    scmIpSecurityRestrictionsUseMain: baseApiFunctionAppConfigProperties.scmIpSecurityRestrictionsUseMain
    linuxFxVersion: baseApiFunctionAppConfigProperties.linuxFxVersion
    ftpsState: baseApiFunctionAppConfigProperties.ftpsState
    cors: {
      allowedOrigins: apiSlotCorsAllowOrigins
    }
  }
  dependsOn: [
    apiFunctionApp::slot
  ]
}

resource apiSlotAppSettings 'Microsoft.Web/sites/slots/config@2023-12-01' = {
  name: '${apiFunctionName}/${slotName}/appsettings'
  properties: union(
    apiSlotBaseAppSettingsObject,
    createApplicationInsights
      ? {
          APPLICATIONINSIGHTS_CONNECTION_STRING: apiFunctionAppInsights.outputs.connectionString
          APPLICATIONINSIGHTS_ENABLE_LOG_AGGREGATION: 'false'
          AzureFunctionsJobHost__logging__console__isEnabled: 'false'
        }
      : {},
    {
      INFO_SHA: gitSha
      MyTaskHub: slotName
      COSMOS_DATABASE_NAME: e2eDatabaseName
      MSSQL_DATABASE_DXTR: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-DATABASE-DXTR)'
      AzureWebJobsStorage: apiFunctionSlotStorageAccount.outputs.connectionString
      AzureWebJobsDataflowsStorage: dataflowsSlotStorageConnectionString
    }
  )
  dependsOn: [
    apiFunctionApp::slot
  ]
}

var baseApiFunctionAppConfigProperties = union(
  {
    numberOfWorkers: 1
    alwaysOn: true
    http20Enabled: true
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
    ftpsState: 'Disabled'
  },
  isElasticFunctionsPlan
    ? {
        functionAppScaleLimit: 1
        minimumElasticInstanceCount: 1
      }
    : {}
)

  var prodFunctionAppConfigProperties = union(baseApiFunctionAppConfigProperties, {
    ipSecurityRestrictions: productionIpSecurityRestrictionsRules
    cors: {
      allowedOrigins: apiCorsAllowOrigins
    }
  })

// config/appsettings deployed as a separate top-level resource (not nested in config/web)
// to avoid error 01019 "Invalid values supplied for Azure Files related app settings"
// which occurs when appSettings containing storage references race Azure Files initialization.
resource apiMainAppSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  name: 'appsettings'
  parent: apiFunctionApp
  properties: union(
    apiSlotBaseAppSettingsObject,
    createApplicationInsights
      ? {
          APPLICATIONINSIGHTS_CONNECTION_STRING: apiFunctionAppInsights.outputs.connectionString
          APPLICATIONINSIGHTS_ENABLE_LOG_AGGREGATION: 'false'
          AzureFunctionsJobHost__logging__console__isEnabled: 'false'
        }
      : {},
    {
      INFO_SHA: 'ProductionSlot'
      MyTaskHub: 'main'
      COSMOS_DATABASE_NAME: cosmosDatabaseName
      MSSQL_DATABASE_DXTR: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-DATABASE-DXTR)'
      AzureWebJobsStorage: apiFunctionStorageAccount.outputs.connectionString
      AzureWebJobsDataflowsStorage: dataflowsStorageConnectionString
    }
  )
}

module apiFunctionAppInsights 'lib/app-insights/function-app-insights.bicep' = {
  name: 'appi-${apiFunctionName}-module'
  scope: resourceGroup()
  params: {
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
    actionGroupSubscriptionId: actionGroupSubscriptionId
    analyticsWorkspaceId: analyticsWorkspaceId
    createAlerts: createAlerts
    createApplicationInsights: createApplicationInsights
    functionAppName: apiFunctionName
    tags: tags
  }
  dependsOn: [
    apiFunctionApp
  ]
}

//TODO: Clear segregation with DXTR vs ACMS variable/secret naming in GitHub and ADO secret libraries

// Flat object form of application settings for use with config/appsettings resources
// (which require a {KEY: VALUE} object rather than the [{name, value}] array format used by config/web).
var apiSlotBaseAppSettingsObject = union(
  {
    FUNCTIONS_EXTENSION_VERSION: functionsVersion
    FUNCTIONS_WORKER_RUNTIME: functionsRuntime
    CAMS_LOGIN_PROVIDER_CONFIG: loginProviderConfig
    CAMS_LOGIN_PROVIDER: loginProvider
    STARTING_MONTH: '-70'
    ADMIN_KEY: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ADMIN-KEY)'
    MONGO_CONNECTION_STRING: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MONGO-CONNECTION-STRING)'
    WEBSITE_RUN_FROM_PACKAGE: '1'
    SCM_DO_BUILD_DURING_DEPLOYMENT: false
    MSSQL_HOST: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-HOST)'
    MSSQL_CLIENT_ID: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-CLIENT-ID)'
    MSSQL_ENCRYPT: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-ENCRYPT)'
    MSSQL_TRUST_UNSIGNED_CERT: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-TRUST-UNSIGNED-CERT)'
    MSSQL_REQUEST_TIMEOUT: mssqlRequestTimeout
    ACMS_MSSQL_HOST: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-HOST)'
    ACMS_MSSQL_DATABASE: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-DATABASE)'
    ACMS_MSSQL_ENCRYPT: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-ENCRYPT)'
    ACMS_MSSQL_TRUST_UNSIGNED_CERT: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-TRUST-UNSIGNED-CERT)'
    ACMS_MSSQL_REQUEST_TIMEOUT: mssqlRequestTimeout
    FEATURE_FLAG_SDK_KEY: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=FEATURE-FLAG-SDK-KEY)'
    CAMS_USER_GROUP_GATEWAY_CONFIG: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=CAMS-USER-GROUP-GATEWAY-CONFIG)'
    OKTA_API_KEY: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=OKTA-API-KEY)'
    MAX_OBJECT_DEPTH: maxObjectDepth
    MAX_OBJECT_KEY_COUNT: maxObjectKeyCount
    DEFAULT_NOTIFICATION_RECIPIENT: defaultNotificationRecipient
    ACS_EMAIL_CONNECTION_STRING: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACS-EMAIL-CONNECTION-STRING)'
    ACS_EMAIL_SENDER_ADDRESS: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACS-EMAIL-SENDER-ADDRESS)'
  },
  isUstpDeployment
    ? {
        MSSQL_USER: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-USER)'
        MSSQL_PASS: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-PASS)'
        ACMS_MSSQL_USER: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-USER)'
        ACMS_MSSQL_PASS: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-PASS)'
      }
    : {
        MSSQL_CLIENT_ID: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=MSSQL-CLIENT-ID)'
        ACMS_MSSQL_CLIENT_ID: '@Microsoft.KeyVault(VaultName=${kvAppConfigName};SecretName=ACMS-MSSQL-CLIENT-ID)'
      }
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
    tags: tags
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
    tags: tags
  }
  dependsOn: [
    apiFunctionApp::slot
  ]
}


// A VNet rule is created only for same-region consumers. Azure enforces
// same-region between a SQL server and any subnet referenced by a
// virtualNetworkRules resource, which a cross-region branch (subnets follow
// AZ-FUNCTIONS-LOCATION) cannot satisfy -- those set useSqlPrivateLink and
// reach SQL through the shared hub instead, with no rule of their own.
var createSqlServerVnetRule = !useSqlPrivateLink && !empty(sqlServerResourceGroupName) && !empty(sqlServerName) && !isUstpDeployment

module setApiFunctionSqlServerVnetRule './lib/network/sql-vnet-rule.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlServerResourceGroupName)
  name: '${apiFunctionName}-sql-vnet-rule-module'
  params: {
    stackName: apiFunctionName
    sqlServerName: sqlServerName
    subnetId: apiFunctionSubnetId
  }
}


// The identity itself is created once, in app-shared-setup.bicep (CAMS-760,
// Option E / Slice 2) — its name is a fixed value shared by main and every
// branch, so it must never be created/managed inside a branch's app stack.
// Referenced here by constructed resource ID only. An `existing` declaration
// emits an ARM resource entry for its scope; for USTP, that can force resolution
// of the SQL resource group in the deploying subscription even when the identity
// is not attached. This block only needs an ID string for the optional Function
// App identity map, so resourceId() avoids scope resolution and supports a
// foreign identity subscription. Wrong values are only validated if the ID is
// actually consumed.
var sqlIdentityName = !empty(sqlServerIdentityName) ? sqlServerIdentityName : sqlIdentityNameFor(stackName)
var sqlIdentityRG = !empty(sqlServerIdentityResourceGroupName)
  ? sqlServerIdentityResourceGroupName
  : sqlServerResourceGroupName
var sqlIdentitySubscriptionId = !empty(sqlServerIdentitySubscriptionId)
  ? sqlServerIdentitySubscriptionId
  : subscription().subscriptionId

var sqlIdentityResourceId = resourceId(
  sqlIdentitySubscriptionId,
  sqlIdentityRG,
  'Microsoft.ManagedIdentity/userAssignedIdentities',
  sqlIdentityName
)

output appInsightsId string = createApplicationInsights ? apiFunctionAppInsights.outputs.id : ''
