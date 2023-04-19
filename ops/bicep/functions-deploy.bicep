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
param functionsRuntime string

@description('Azure functions version')
param functionsVersion string

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
  kind: 'app'
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
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: ustpFunctionsServicePlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${functionsStorageName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${ustpFunctionsStorageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${functionsStorageName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${ustpFunctionsStorageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionsAppName)
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
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
  }
}
