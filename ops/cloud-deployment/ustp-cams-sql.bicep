@description('Flag to create diagnostic setting for sql')
param createSqlServerDiagnosticSetting bool = false

@description('The name of the SQL database.')
param databaseName string

@description('Database Name Prefix')
param databasePrefix string

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string

module sqlServerDiagnosticSettings './app-insights/diagnostics-settings-sql.bicep' = if (createSqlServerDiagnosticSetting && !empty(analyticsWorkspaceId)) {
  name: '${databaseName}-sql-diagnostics-settings-module'
  params: {
    databaseName: databaseName
    databasePrefix: databasePrefix
    analyticsWorkspaceId: analyticsWorkspaceId
  }
}
