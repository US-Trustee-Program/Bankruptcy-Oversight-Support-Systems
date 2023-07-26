param appName string
param location string = resourceGroup().location

param resourceGroupName string

param deployCosmosDb bool = false

param accountName string
param databaseName string
param databaseContainers array = [
  {
    name: 'healthcheck'
    partitionKey1: '/id'
  }
]

module account './cosmos/cosmos-account.bicep' = if (deployCosmosDb) {
  name: '${appName}-cosmos-account-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    location: location
  }
}

module database './cosmos/cosmos-database.bicep' = if (deployCosmosDb) {
  name: '${appName}-cosmos-database-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    databaseName: databaseName
  }
  dependsOn: [
    account
  ]
}

module containers './cosmos/cosmos-containers.bicep' = if (deployCosmosDb) {
  name: '${appName}-cosmos-containers-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    databaseName: databaseName
    databaseContainers: databaseContainers
  }
  dependsOn: [
    database
  ]
}
