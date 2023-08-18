@description('The name of the diagnostic setting.')
param settingName string

@description('The name of the database.')
param dbName string

@description('The resource Id of the workspace.')
param analyticsWorkspaceId string


resource setting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: 'Microsoft.DocumentDB/databaseAccounts/${dbName}'
  name: settingName
  properties: {
    workspaceId: analyticsWorkspaceId
    logs: [
      {
        category: 'DataPlaneRequests'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'MongoRequests'
        categoryGroup: null
        enabled: false
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'QueryRuntimeStatistics'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'PartitionKeyStatistics'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'PartitionKeyRUConsumption'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'ControlPlaneRequests'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'CassandraRequests'
        categoryGroup: null
        enabled: false
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'GremlinRequests'
        categoryGroup: null
        enabled: false
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'TableApiRequests'
        categoryGroup: null
        enabled: false
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
    ]
    metrics: [
      {
        timeGrain: null
        enabled: false
        retentionPolicy: {
          days: 0
          enabled: false
        }
        category: 'Requests'
      }
    ]
  }
}
