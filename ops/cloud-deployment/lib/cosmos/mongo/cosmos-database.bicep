@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Database to create')
param databaseName string = 'cams'

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-09-15' existing = {
  name: accountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' = {
  parent: account
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}
