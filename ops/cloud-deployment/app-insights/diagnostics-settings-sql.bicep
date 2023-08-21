@description('The name of the Azure SQL database server.')
param serverName string = 'sql-ustp-cams.database.usgovcloudapi.net'

@description('The name of the SQL database.')
param databaseName string = 'ACMS_REP_SUB'

@description('The resource Id of the workspace.')
param workspaceId string

resource dbServer 'Microsoft.Sql/servers@2021-11-01-preview' existing = {
  name: serverName
}

resource db 'Microsoft.Sql/servers/databases@2021-11-01-preview' existing = {
  parent: dbServer
  name: databaseName
}

resource setting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${databaseName}-diagnostic-setting'
  scope: db
  properties: {
    workspaceId: workspaceId
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
