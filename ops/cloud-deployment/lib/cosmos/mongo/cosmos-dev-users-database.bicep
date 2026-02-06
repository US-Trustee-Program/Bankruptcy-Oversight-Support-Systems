@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Dev users database name')
param devUsersDatabaseName string = 'dev-users'

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' existing = {
  name: accountName
}

resource devUsersDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' = {
  parent: account
  name: devUsersDatabaseName
  properties: {
    resource: {
      id: devUsersDatabaseName
    }
  }
}

resource devUsersCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: devUsersDatabase
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      shardKey: {
        username: 'Hash'
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
              'username'
            ]
          }
          options: {
            unique: true
          }
        }
      ]
    }
  }
}
