/*
  Enable all logs and metrics for Azure Function App resource

  Azure provides the following destination options
  - Send to Log Analytics workspace   [SUPPORTED]
  - Archive to a storage account      [NOT YET SUPPORTED]
  - Stream to an event hub            [NOT YET SUPPORTED]
  - Send to partner solution          [NOT YET SUPPORTED]
*/
@description('Name of Function App resource')
param functionAppName string

@description('OPTIONAL. Resource id of log analytics workspace which data will be ingested to.')
param workspaceResourceId string = '' // For "Send to Log Analytics workspace"

resource functionApp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: functionAppName
}

var logRetentionPolicy = {
  days: 30
  enabled: true
}

var metricRetentionPolicy = {
  days: 30
  enabled: true
}

var metricsEnableAll = [
  {
    category: 'AllMetrics'
    enabled: true
    retentionPolicy: metricRetentionPolicy
  }
]

var functionAppLogsEnableAll = [
  {
    category: 'FunctionAppLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
]

@description('Enable all diagnostic logs/metrics for a Function App resource and send data to target Log Analytics workspace for ingestion.')
resource diagnosticLogsToLogAnalyticsWorkspace 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(workspaceResourceId)) {
  name: functionApp.name
  scope: functionApp
  properties: {
    workspaceId: workspaceResourceId
    logs: functionAppLogsEnableAll
    metrics: metricsEnableAll
  }
}
