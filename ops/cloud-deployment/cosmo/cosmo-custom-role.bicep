@description('Cosmos DB account name, max length 44 characters')
param accountName string

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: accountName
}

var cosmoDbReadWriteRoleName = 'CosmoDbReadWrite${accountName}'
resource customRoleDefinition 'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions@2023-04-15' = {
  parent: account
  name: guid(cosmoDbReadWriteRoleName)
  properties: {
    roleName: cosmoDbReadWriteRoleName
    type: 'CustomRole'
    assignableScopes: [
      account.id
    ]
    permissions: [
      {
        dataActions: [
          'Microsoft.DocumentDB/databaseAccounts/readMetadata'
          'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/*'
          'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/*'
        ]
        notDataActions: []
      }
    ]
  }
}

output roleDefinitionId string = customRoleDefinition.name
