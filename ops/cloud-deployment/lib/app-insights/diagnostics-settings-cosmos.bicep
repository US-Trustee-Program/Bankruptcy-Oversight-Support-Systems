@description('The name of the diagnostic setting.')
param settingName string

@description('Cosmos Account Name')
param accountName string

@description('The resource Id of the workspace.')
param analyticsWorkspaceId string

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' existing = {
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
      }
      {
        category: 'QueryRuntimeStatistics'
        categoryGroup: null
        enabled: true
      }
      {
        category: 'PartitionKeyStatistics'
        categoryGroup: null
        enabled: true
      }
      {
        category: 'PartitionKeyRUConsumption'
        categoryGroup: null
        enabled: true
      }
      {
        category: 'ControlPlaneRequests'
        categoryGroup: null
        enabled: true
      }
      {
        category: 'TableApiRequests'
        categoryGroup: null
        enabled: false
      }
    ]
    metrics: [
      {
        timeGrain: null
        enabled: false
        category: 'Requests'
      }
    ]
  }
}
