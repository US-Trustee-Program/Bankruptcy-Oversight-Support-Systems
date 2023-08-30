@description('Flag to create diagnostic setting for sql')
param createSqlServerDiagnosticSetting bool = false

@description('The name of the SQL database.')
param databaseName string

@description('Database Name Prefix')
param databasePrefix string

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string

@description('Action Group ID for alerts')
param actionGroupId string = ''

param serverId string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/bankruptcy-oversight-support-systems/providers/Microsoft.Sql/servers/sql-ustp-cams'

module sqlServerDiagnosticSettings './app-insights/diagnostics-settings-sql.bicep' = if (createSqlServerDiagnosticSetting && !empty(analyticsWorkspaceId)) {
  name: '${databaseName}-sql-diagnostics-settings-module'
  params: {
    databaseName: databaseName
    databasePrefix: databasePrefix
    analyticsWorkspaceId: analyticsWorkspaceId
  }
}

module sqlHealthAlert './monitoring-alerts/sql-health-alert-rule.bicep' = {
  name: '${databaseName}-health-alert-module'
  params: {
    sqlAlertName: '${databaseName}-health-alert'
    actionGroupId: actionGroupId
    serverId: serverId
    resourceGroup: resourceGroup().name
    targetResourceType: 'Microsoft.Sql/servers/databases'
    databaseName: databaseName
  }
}

module sqlSpaceAlert './monitoring-alerts/metrics-alert-rule.bicep' = {
  name: '${databaseName}-low-space-alert-module'
  params: {
    alertName: '${databaseName}-low-space-alert'
    appId: '${serverId}/databases/${databaseName}'
    actionGroupId: actionGroupId
    timeAggregation: 'Maximum'
    operator: 'GreaterThan'
    severity: 1
    threshold: 85
    metricName: 'storage_percent'
    targetResourceType: 'Microsoft.Sql/servers/databases'


  }
}
