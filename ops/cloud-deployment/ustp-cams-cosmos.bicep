param location string = resourceGroup().location
@description('Existing resource group name for new CosmosDb instance')
param resourceGroupName string
@description('CosmosDb account name')
param accountName string
@description('CosmosDb database name')
param databaseName string
@description('List of container name and keys')
param databaseContainers array = [
  {
    name: 'healthcheck'
    partitionKey1: '/id'
  }
]

// CosmosDb
module account './cosmos/cosmos-account.bicep' = {
  name: '${accountName}-cosmos-account-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    location: location
  }
}

module database './cosmos/cosmos-database.bicep' = {
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

module containers './cosmos/cosmos-containers.bicep' = {
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

// Role definition for read and write access
module customReadWriteRole './cosmos/cosmos-custom-role.bicep' = {
  name: '${accountName}-cosmos-roles-module'
  params: {
    accountName: accountName
  }
}

// Identity to access CosmosDb
module cosmosDbUserManagedIdentity './id/managed-identity.bicep' = {
  name: '${accountName}-cosmos-user-id-module'
  params: {
    location: location
    managedIdentityName: 'id-${accountName}-user'
  }
}

// Assign permissions (role) to Identity
module cosmosDbRoleAssignment './cosmos/cosmos-role-assignment.bicep' = {
  name: '${accountName}-cosmos-role-assignment-module'
  params: {
    accountName: accountName
    principalId: cosmosDbUserManagedIdentity.outputs.principalId
    roleDefinitionId: customReadWriteRole.outputs.roleDefinitionId
  }
}


output cosmosDbManagedIdentity string = cosmosDbUserManagedIdentity.outputs.clientId
