@description('cosmos db account name, max length 44 characters')
param accountname string

@description('target database')
param databasename string

@description('list of objects with following properties: name, partitionkey1')
param databasecollections array

resource account 'microsoft.documentdb/databaseaccounts@2023-04-15' existing = {
  name: accountname
}

resource database 'microsoft.documentdb/databaseaccounts/mongodbdatabases@2023-11-15' existing = {
  parent: account
  name: databasename
}

resource datacollections 'microsoft.documentdb/databaseaccounts/mongodbdatabases/collections@2023-11-15' = [
  for c in databasecollections: {
    parent: database
    name: c.name
    properties: {
      resource: {
        id: c.name
        shardkey: {
          '${c.partitionkey1}': 'hash'
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
                '${c.partitionkey1}'
              ]
            }
          }
        ]
      }
    }
  }
]

resource sessioncollection 'microsoft.documentdb/databaseaccounts/mongodbdatabases/collections@2023-11-15' = {
  parent: database
  name: 'user-session-cache'
  properties: {
    resource: {
      id: 'user-session-cache'
      shardkey: {
        signature: 'hash'
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
            unique: true
          }
        }
        {
          key: {
            keys: ['_ts']
          }
          options: {
            expireafterseconds: -1
          }
        }
      ]
    }
  }
}

resource officescollection 'microsoft.documentdb/databaseaccounts/mongodbdatabases/collections@2023-11-15' = {
  parent: database
  name: 'offices'
  properties: {
    resource: {
      id: 'offices'
      shardkey: {
        officecode: 'hash'
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
            keys: ['_ts']
          }
          options: {
            expireafterseconds: -1
          }
        }
        {
          key: {
            keys: [
              'officecode'
              'id'
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

resource userscollection 'microsoft.documentdb/databaseaccounts/mongodbdatabases/collections@2023-11-15' = {
  parent: database
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      shardkey: {
        id: 'string'
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
              'id'
              'documenttype'
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
