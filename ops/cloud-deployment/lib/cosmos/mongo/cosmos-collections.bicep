@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Target Database')
param databaseName string

@description('List of objects with following properties: name, partitionKey1')
param databaseCollections array

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: accountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' existing = {
  parent: account
  name: databaseName
}

resource dataCollections 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = [for c in databaseCollections: {
  parent: database
  name: c.name
  properties: {
    resource: {
      id: c.name
      shardKey: {
        '${c.partitionKey1}': 'Hash'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
        {
          key: {
            keys: [
              '$**'
            ]
          }
       }
       {
          key: {
            keys: [
              '${c.partitionKey1}'
            ]
          }
        }
      ]
    }
  }
}]

resource sessionCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'user-session-cache'
  properties: {
    resource: {
      id: 'user-session-cache'
      shardKey: {
        signature: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
        {
          key: {
            keys: [
              '$**'
            ]
          }
       }
       {
          key: {
            keys: [
              'signature'
            ]
          }
          options: {
            unique:true
          }
        }
      ]
    }
  }
}

resource officesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'offices'
  properties: {
    resource: {
      id: 'offices'
      shardKey: {
        officeCode: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
        {
          key: {
            keys: [
              '$**'
            ]
          }
       }
       {
          key: {
            keys: [
              'officeCode'
              'userId'
            ]
          }
          options: {
            unique:true
          }
        }
      ]
    }
  }
}
