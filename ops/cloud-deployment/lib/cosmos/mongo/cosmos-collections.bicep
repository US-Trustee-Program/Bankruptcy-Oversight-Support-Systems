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

resource dataCollections 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = [
  for c in databaseCollections: {
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
  }
]

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
            unique: true
          }
        }
        {
          key: {
            keys: ['_ts']
          }
          options: {
            expireAfterSeconds: -1
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
            keys: ['_ts']
          }
          options: {
            expireAfterSeconds: -1
          }
        }
        {
          key: {
            keys: [
              'officeCode'
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

resource usersCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      shardKey: {
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
              'documentType'
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

resource casesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'cases'
  properties: {
    resource: {
      id: 'cases'
      shardKey: {
        caseId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['id']
          }
        }
        {
          key: {
            keys: ['caseId']
          }
        }
        {
          key: {
            keys: ['caseNumber']
          }
        }
        {
          key: {
            keys: ['chapter']
          }
        }
        {
          key: {
            keys: ['courtDivisionCode']
          }
        }
        {
          key: {
            keys: ['documentType']
          }
        }
        {
          key: {
            keys: ['dateFiled', 'caseNumber']
          }
        }
      ]
    }
  }
}

resource officeAssigneesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'office-assignees'
  properties: {
    resource: {
      id: 'office-assignees'
      shardKey: {
        officeCode: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['caseId']
          }
        }
        {
          key: {
            keys: ['officeCode']
          }
        }
        {
          key: {
            keys: ['userId']
          }
        }
      ]
    }
  }
}

resource listsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'lists'
  properties: {
    resource: {
      id: 'lists'
      shardKey: {
        list: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['list']
          }
        }
        {
          key: {
            keys: ['key']
          }
        }
        {
          key: {
            keys: [
              'list'
              'key'
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

resource trusteesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'trustees'
  properties: {
    resource: {
      id: 'trustees'
      shardKey: {
        trusteeId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: [
              '$**'
            ]
          }
        }
      ]
    }
  }
}

resource trusteeAppointmentsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'trustee-appointments'
  properties: {
    resource: {
      id: 'trustee-appointments'
      shardKey: {
        trusteeId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['trusteeId']
          }
        }
      ]
    }
  }
}

resource userGroupsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'user-groups'
  properties: {
    resource: {
      id: 'user-groups'
      shardKey: {
        groupName: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['id']
          }
        }
        {
          key: {
            keys: ['groupName']
          }
        }
      ]
    }
  }
}
