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

resource dataContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = [for c in databaseContainers: {
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
    }
  }
}]

resource sessionContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'user-session-cache'
  properties: {
    resource: {
      id: 'user-session-cache'
      partitionKey: {
        paths: [
          '/signature'
        ]
      }
      defaultTtl: -1
      uniqueKeyPolicy: { uniqueKeys: [{ paths: ['/signature'] }] }
    }
  }
}

resource officesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'offices'
  properties: {
    resource: {
      id: 'offices'
      partitionKey: {
        paths: [
          '/officeCode'
        ]
      }
      defaultTtl: -1
    }
  }
}
