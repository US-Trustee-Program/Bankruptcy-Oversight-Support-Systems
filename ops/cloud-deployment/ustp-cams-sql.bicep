@description('Flag to create diagnostic setting for sql')
param createSqlServerDiagnosticSetting bool = false

@description('The name of the SQL database.')
param databaseName string

@description('Database Name Prefix')
param databasePrefix string

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string

@description('Action Group Name for alerts')
param actionGroupName string

@description('Action Group Resource Group Name for alerts')
param actionGroupResourceGroupName string

module sqlServerDiagnosticSettings './lib/app-insights/diagnostics-settings-sql.bicep' = if (createSqlServerDiagnosticSetting && !empty(analyticsWorkspaceId)) {
  name: '${databaseName}-sql-diagnostics-settings-module'
  params: {
    databaseName: databaseName
    databasePrefix: databasePrefix
    analyticsWorkspaceId: analyticsWorkspaceId
  }
}
module sqlSpaceAlert './lib/monitoring-alerts/metrics-alert-rule.bicep' = {
  name: '${databaseName}-low-space-alert-module'
  params: {
    alertName: '${databaseName}-low-space-alert'
    appId: '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/${resourceGroup().name}/providers/Microsoft.Sql/servers/${databasePrefix}/databases/${databaseName}'
    timeAggregation: 'Maximum'
    operator: 'GreaterThan'
    severity: 1
    threshold: 85
    metricName: 'storage_percent'
    targetResourceType: 'Microsoft.Sql/servers/databases'
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
  }
}
