@description('Existing resource group name for new CosmosDb instance')
param resourceGroupName string
@description('Existing CosmosDb account name')
param accountName string
@description('CosmosDb database name')
param databaseName string
@description('List of container name and keys')
param databaseCollections array = [] // See parameters.json file

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-09-15' existing = {
  name: accountName
  scope: resourceGroup(resourceGroupName)
}

module database './lib/cosmos/mongo/cosmos-database.bicep' = {
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

module containers './lib/cosmos/mongo/cosmos-collections.bicep' = {
  name: '${accountName}-cosmos-containers-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    databaseName: databaseName
    databaseCollections: databaseCollections
  }
  dependsOn: [
    database
  ]
}
