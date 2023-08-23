@description('The name of the diagnostic setting.')
param settingName string

@description('Cosmos Account Name')
param accountName string

@description('The resource Id of the workspace.')
param analyticsWorkspaceId string

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: accountName
}

resource setting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: settingName
  scope: account
  properties: {
    workspaceId: analyticsWorkspaceId
    logs: [
      {
        category: 'DataPlaneRequests'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: false
        }
      }
      {
        category: 'QueryRuntimeStatistics'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: false
        }
      }
      {
        category: 'PartitionKeyStatistics'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: false
        }
      }
      {
        category: 'PartitionKeyRUConsumption'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: false
        }
      }
      {
        category: 'ControlPlaneRequests'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: false
        }
      }
      {
        category: 'TableApiRequests'
        categoryGroup: null
        enabled: false
        retentionPolicy: {
          days: 30
          enabled: false
        }
      }
    ]
    metrics: [
      {
        timeGrain: null
        enabled: false
        retentionPolicy: {
          days: 30
          enabled: false
        }
        category: 'Requests'
      }
    ]
  }
}
