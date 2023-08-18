@description('The name of the diagnostic setting.')
param settingName string

@description('The name of the Azure SQL database server.')
param serverName string

@description('The name of the SQL database.')
param dbName string

@description('The resource Id of the workspace.')
param workspaceId string

@description('The resource Id of the storage account.')
param storageAccountId string

@description('The resource Id of the event hub authorization rule.')
param eventHubAuthorizationRuleId string

@description('The name of the event hub.')
param eventHubName string

resource dbServer 'Microsoft.Sql/servers@2021-11-01-preview' existing = {
  name: serverName
}

resource db 'Microsoft.Sql/servers/databases@2021-11-01-preview' existing = {
  parent: dbServer
  name: dbName
}

resource setting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: settingName
  scope: db
  properties: {
    workspaceId: workspaceId
    storageAccountId: storageAccountId
    eventHubAuthorizationRuleId: eventHubAuthorizationRuleId
    eventHubName: eventHubName
    logs: [
      {
        category: 'SQLInsights'
        enabled: true
      }
      {
        category: 'AutomaticTuning'
        enabled: true
      }
      {
        category: 'QueryStoreRuntimeStatistics'
        enabled: true
      }
      {
        category: 'QueryStoreWaitStatistics'
        enabled: true
      }
      {
        category: 'Errors'
        enabled: true
      }
      {
        category: 'DatabaseWaitStatistics'
        enabled: true
      }
      {
        category: 'Timeouts'
        enabled: true
      }
      {
        category: 'Blocks'
        enabled: true
      }
      {
        category: 'Deadlocks'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Basic'
        enabled: true
      }
      {
        category: 'InstanceAndAppAdvanced'
        enabled: true
      }
      {
        category: 'WorkloadManagement'
        enabled: true
      }
    ]
  }
}
