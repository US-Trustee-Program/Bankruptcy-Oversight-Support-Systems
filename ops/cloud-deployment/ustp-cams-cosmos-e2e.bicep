@description('Existing resource group name for new CosmosDb instance')
param resourceGroupName string
@description('Existing CosmosDb account name')
param accountName string
@description('CosmosDb database name')
param databaseName string
@description('List of container name and keys')
param databaseContainers array = [] // See parameters.json file

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: accountName
  scope: resourceGroup(resourceGroupName)
}

module database './lib/cosmos/cosmos-database.bicep' = {
  name: '${accountName}-cosmos-database-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    databaseName: databaseName
  }
  dependsOn: [
    account
  ]
}

module containers './lib/cosmos/cosmos-containers.bicep' = {
  name: '${accountName}-cosmos-containers-module'
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
