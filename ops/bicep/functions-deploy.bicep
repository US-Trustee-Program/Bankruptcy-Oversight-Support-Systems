@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('Application service plan name')
param functionsAspName string = '${appName}-functions-asp'

@description('Azure functions app name')
param functionsAppName string = '${appName}-function-app'

@description('Existing Private DNS Zone used for application')
param privateDnsZoneName string

@description('Existing virtual network name')
param virtualNetworkName string

@description('Resource group name of target virtual network')
param virtualNetworkResourceGroupName string

@description('Backend Azure Functions subnet name')
param backendFunctionsSubnetName string = '${virtualNetworkName}-function-app'

@description('Backend Azure Functions subnet ip ranges')
param backendFunctionsSubnetAddressPrefix string = '10.0.4.0/28'

@description('Backend private endpoint subnet name')
param backendPrivateEndpointSubnetName string = '${virtualNetworkName}-function-pe'

@description('Backend private endpoint subnet ip ranges')
param backendPrivateEndpointSubnetAddressPrefix string = '10.0.5.0/28'

@description('Azure functions runtime environment')
@allowed([
  'java'
])
param functionsRuntime string = 'java'

@description('Azure functions version')
param functionsVersion string = '~4'

@description('Storage account name. Default creates unique name from resource group id and application name')
param functionsStorageName string = 'ustp${uniqueString(resourceGroup().id, appName)}func'

@description('List of origins to allow')
param corsAllowOrigins array = []

@description('Database connection string')
@secure()
param databaseConnectionString string = ''

@description('Resource group name of database server')
param sqlServerResourceGroupName string = ''

@description('Database server name')
param sqlServerName string

/*
  App service plan (hosting plan) for Azure functions instances
*/
resource ustpFunctionsServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: functionsAspName
  sku: {
    name: 'P1v2'
    tier: 'PremiumV2'
    size: 'P1v2'
    family: 'Pv2'
    capacity: 1
  }
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
module backendSubnet './network-subnet-deploy.bicep' = {
  name: '${appName}-backend-subnet-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    virtualNetworkName: virtualNetworkName
    subnetName: backendFunctionsSubnetName
    subnetAddressPrefix: backendFunctionsSubnetAddressPrefix
    subnetServiceEndpoints: [
      {
        service: 'Microsoft.Sql'
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
module backendPrivateEndpoint './network-subnet-pe-deploy.bicep' = {
  name: '${appName}-backend-pe-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    prefixName: appName
    location: location
    virtualNetworkName: virtualNetworkName
    privateDnsZoneName: privateDnsZoneName
    privateEndpointSubnetName: backendPrivateEndpointSubnetName
    privateEndpointSubnetAddressPrefix: backendPrivateEndpointSubnetAddressPrefix
    privateLinkServiceId: functionApp.id
  }
}

/*
  Storage resource for Azure functions
*/
resource ustpFunctionsStorageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: functionsStorageName
  location: location
  sku: {
    name: 'Standard_LRS' // Other options :: Standard_LRS | Standard_GRS | Standard_RAGRS
  }
  kind: 'Storage'
  properties: {
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

/*
  Create functionapp
*/
var defaultAppSettings = concat([
    {
      name: 'AzureWebJobsStorage'
      value: 'DefaultEndpointsProtocol=https;AccountName=${functionsStorageName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${ustpFunctionsStorageAccount.listKeys().keys[0].value}'
    }
    {
      name: 'FUNCTIONS_EXTENSION_VERSION'
      value: functionsVersion
    }
    {
      name: 'FUNCTIONS_WORKER_RUNTIME'
      value: functionsRuntime
    }
  ], empty(databaseConnectionString) ? [] : [ { name: 'SQL_SERVER_CONN_STRING', value: databaseConnectionString } ])
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionsAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    enabled: true
    serverFarmId: ustpFunctionsServicePlan.id
    siteConfig: {
      appSettings: defaultAppSettings
      numberOfWorkers: 1
      linuxFxVersion: 'JAVA|17'
      alwaysOn: true
      http20Enabled: true
      functionAppScaleLimit: 0
      minimumElasticInstanceCount: 0
      publicNetworkAccess: 'Disabled'
    }
    clientAffinityEnabled: false
    httpsOnly: true
    redundancyMode: 'None'
    virtualNetworkSubnetId: backendSubnet.outputs.subnetId
  }
}

var setCors = length(corsAllowOrigins) > 0
resource functionAppConfig 'Microsoft.Web/sites/config@2022-09-01' = if (setCors) {
  parent: functionApp
  name: 'web'
  properties: {
    cors: {
      allowedOrigins: corsAllowOrigins
    }
  }
}

module setSqlServerVnetRule './sql-vnet-rule-deploy.bicep' = {
  scope: resourceGroup(sqlServerResourceGroupName)
  name: '${appName}-sql-vnet-rule-module'
  params: {
    prefixName: appName
    sqlServerName: sqlServerName
    subnetId: backendSubnet.outputs.subnetId
  }
}

output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
