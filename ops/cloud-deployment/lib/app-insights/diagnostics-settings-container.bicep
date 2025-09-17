/*
  Enable all logs and metrics for Azure Container App resource

  Azure provides the following destination options
  - Send to Log Analytics workspace   [SUPPORTED]
  - Archive to a storage account      [NOT YET SUPPORTED]
  - Stream to an event hub            [NOT YET SUPPORTED]
  - Send to partner solution          [NOT YET SUPPORTED]
*/
@description('Name of Container App resource')
param containerAppName string

@description('OPTIONAL. Resource id of log analytics workspace which data will be ingested to.')
param workspaceResourceId string = '' // For "Send to Log Analytics workspace"

resource containerApp 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: containerAppName
}

var metricsEnableAll = [
  {
    category: 'AllMetrics'
    enabled: true
  }
]

var containerAppLogsEnableAll = [
  {
    category: 'ContainerAppConsoleLogs'
    enabled: true
  }
  {
    category: 'ContainerAppSystemLogs'
    enabled: true
  }
]

@description('Enable all diagnostic logs/metrics for a Container App resource and send data to target Log Analytics workspace for ingestion.')
resource diagnosticLogsToLogAnalyticsWorkspace 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(workspaceResourceId)) {
  name: containerApp.name
  scope: containerApp
  properties: {
    workspaceId: workspaceResourceId
    logs: containerAppLogsEnableAll
    metrics: metricsEnableAll
  }
}
