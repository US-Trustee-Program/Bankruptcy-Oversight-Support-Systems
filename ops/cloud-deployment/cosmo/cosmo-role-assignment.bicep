@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Object ID of the AAD identity. Must be a GUID.')
param principalId string

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: accountName
}

var cosmoDbReadWriteRoleName = 'CosmoDbReadWrite${accountName}'
resource roleDefinition 'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions@2023-04-15' existing = {
  name: guid(cosmoDbReadWriteRoleName)
}

var sqlRoleAssignmentName = 'RoleAssignment${accountName}${principalId}'
resource sqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = {
  parent: account
  name: guid(sqlRoleAssignmentName)
  properties: {
    roleDefinitionId: resourceId('Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions', account.name, roleDefinition.name)
    principalId: principalId
    scope: account.id
  }
}
