@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Target Database')
param databaseName string

@description('List of objects with following properties: name, partitionKey1')
param databaseContainers array

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: accountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' existing = {
  parent: account
  name: databaseName
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = [for c in databaseContainers: {
  parent: database
  name: c.name
  properties: {
    resource: {
      id: c.name
      partitionKey: {
        paths: [
          c.partitionKey1
        ]
      }
      defaultTtl: c.name == 'user-session-cache' ? -1 : 0
      uniqueKeyPolicy: { uniqueKeys: c.name == 'user-session-cache' ? [{ paths: ['/signature'] }]: []}
    }
  }
}]
