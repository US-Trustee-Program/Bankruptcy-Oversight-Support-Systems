@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Database to create')
param databaseName string = 'cams'

param mongoUser string

param mongoPass string

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-09-15' existing = {
  name: accountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' existing = {
  parent: account
  name: databaseName
}

var mongoUserDefinitionName = 'userDefinition${accountName}'
resource sqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/mongodbUserDefinitions@2023-11-15' = {
  parent: account
  name: mongoUserDefinitionName
  properties: {
    databaseName: database.name
    mechanisms: 'SCRAM-SHA-256'
    password: mongoPass
    userName: mongoUser
    roles: [
      {
        db: database.name
        role: 'readWrite'
      }
    ]
  }
}
