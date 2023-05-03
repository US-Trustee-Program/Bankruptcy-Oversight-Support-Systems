@description('Provide a name used for labeling related resources')
param stackName string

param location string = resourceGroup().location

@description('Application service plan name')
param planName string

@description('Azure functions app name')
param functionName string

@description('Existing Private DNS Zone used for application')
param privateDnsZoneName string = 'privatelink.azurewebsites.net'

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
param functionsStorageName string = 'ustpfunc${uniqueString(resourceGroup().id, stackName)}'

@description('List of origins to allow. Need to include protocol')
param corsAllowOrigins array = []

@description('Database connection string')
@secure()
param databaseConnectionString string = ''

@description('Resource group name of database server')
param sqlServerResourceGroupName string = ''

@description('Database server name')
param sqlServerName string = ''

/*
  App service plan (hosting plan) for Azure functions instances
*/
resource servicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  location: location
  name: planName
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
module subnet './network-subnet-deploy.bicep' = {
  name: '${stackName}-subnet-module'
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
module privateEndpoint './network-subnet-pe-deploy.bicep' = {
  name: '${stackName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    prefixName: stackName
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
    'Stack Name' : stackName
  }
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
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: servicePlan.id
    enabled: true
    httpsOnly: true
    virtualNetworkSubnetId: subnet.outputs.subnetId
  }
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
  !empty(databaseConnectionString) ? [ { name: 'SQL_SERVER_CONN_STRING', value: databaseConnectionString } ] : []
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
    http20Enabled: false
    functionAppScaleLimit: 0
    minimumElasticInstanceCount: 0
    publicNetworkAccess: 'Disabled'
    linuxFxVersion: linuxFxVersionMap['${functionsRuntime}']
    appSettings: applicationSettings
  }
}

var createSqlServerVnetRule = !empty(sqlServerResourceGroupName) && !empty(sqlServerName)
module setSqlServerVnetRule './sql-vnet-rule-deploy.bicep' = if (createSqlServerVnetRule) {
  scope: resourceGroup(sqlServerResourceGroupName)
  name: '${stackName}-sql-vnet-rule-module'
  params: {
    prefixName: stackName
    sqlServerName: sqlServerName
    subnetId: subnet.outputs.subnetId
  }
}

output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output createdSqlServerVnetRule bool = createSqlServerVnetRule
