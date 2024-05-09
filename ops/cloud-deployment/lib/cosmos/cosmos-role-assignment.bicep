@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Object ID of the AAD identity. Must be a GUID.')
param principalId string

@description('Resource id of role definition')
param roleDefinitionId string

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: accountName
}

var sqlRoleAssignmentName = 'RoleAssignment${accountName}${principalId}'
resource sqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = {
  parent: account
  name: sqlRoleAssignmentName
  properties: {
    roleDefinitionId: roleDefinitionId
    principalId: principalId
    scope: account.id
  }
}
