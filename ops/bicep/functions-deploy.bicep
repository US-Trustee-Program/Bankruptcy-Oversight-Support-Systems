@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('Application service plan name')
param functionsAspName string = '${appName}-functions-asp'

@description('Storage account name. Default creates unique name from resource group id and application name')
param functionsStorageName string = 'ustp${uniqueString(resourceGroup().id, appName)}func'

@description('Azure functions app name')
param functionsAppName string = '${appName}-function-app'

@description('Azure functions runtime environment')
param functionsRuntime string = 'java'

@description('Azure functions version')
param functionsVersion string = '~4'

@description('Azure functions backend subnet resource id for vnet integration')
param backendFuncSubnetId string

@description('Private DNS Zone used for application')
param privateDnsZoneName string

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
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionsAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    enabled: true
    serverFarmId: ustpFunctionsServicePlan.id
    siteConfig: {
      appSettings: [
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
      ]
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
    virtualNetworkSubnetId: backendFuncSubnetId
  }
}

/*
  Backend functionapp private endpoint setup
*/
resource ustpPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = {
  name: privateDnsZoneName
}
var functionsPrivateEndpointName = '${appName}-function-app-private-endpoint'
var functionsPrivateEndpointConnectionName = '${appName}-function-app-private-endpoint-connection'
resource ustpFunctionsPrivateEndpoint 'Microsoft.Network/privateEndpoints@2022-09-01' = {
  name: functionsPrivateEndpointName
  location: location
  properties: {
    privateLinkServiceConnections: [
      {
        name: functionsPrivateEndpointConnectionName
        properties: {
          privateLinkServiceId: functionApp.id
          groupIds: [
            'sites'
          ]
          privateLinkServiceConnectionState: {
            status: 'Approved'
            actionsRequired: 'None'
          }
        }
      }
    ]
    manualPrivateLinkServiceConnections: []
    subnet: {
      id: backendFuncSubnetId
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
  dependsOn: [
    ustpPrivateDnsZone
  ]
}

resource ustpFunctionsPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2022-09-01' = {
  parent: ustpFunctionsPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink_azurewebsites'
        properties: {
          privateDnsZoneId: ustpPrivateDnsZone.id
        }
      }
    ]
  }
}

output outFunctionAppName string = functionApp.name
