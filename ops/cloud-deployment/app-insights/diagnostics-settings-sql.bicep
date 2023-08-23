@description('Database Name Prefix')
param databasePrefix string = 'sql-ustp-cams'

@description('The name of the SQL database.')
param databaseName string = 'ACMS_REP_SUB'

@description('The resource Id of the workspace.')
param analyticsWorkspaceId string

resource database 'Microsoft.Sql/servers/databases@2021-11-01-preview' existing = {
  name: '${databasePrefix}/${databaseName}'
}

resource setting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${databaseName}-diagnostic-setting'
  scope: database
  properties: {
    workspaceId: analyticsWorkspaceId
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
