/*
  Enable all logs and metrics for Azure WebApp resource

  Azure provides the following destination options
  - Send to Log Analytics workspace   [SUPPORTED]
  - Archive to a storage account      [NOT YET SUPPORTED]
  - Stream to an event hub            [NOT YET SUPPORTED]
  - Send to partner solution          [NOT YET SUPPORTED]
*/
@description('Name of Function App resource')
param webappName string

@description('OPTIONAL. Resource id of log analytics workspace which data will be ingested to.')
param workspaceResourceId string = '' // For "Send to Log Analytics workspace"

resource webapp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: webappName
}

var metricsEnableAll = [
  {
    category: 'AllMetrics'
    enabled: true
  }
]

var webappLogsEnableAll = [
  {
    category: 'AppServiceAntivirusScanAuditLogs'
    enabled: true
  }

  {
    category: 'AppServiceHTTPLogs'
    enabled: true
  }

  {
    category: 'AppServiceConsoleLogs'
    enabled: true
  }

  {
    category: 'AppServiceAppLogs'
    enabled: true
  }

  {
    category: 'AppServiceFileAuditLogs'
    enabled: true
  }

  {
    category: 'AppServiceAuditLogs'
    enabled: true
  }

  {
    category: 'AppServiceIPSecAuditLogs'
    enabled: true
  }

  {
    category: 'AppServicePlatformLogs'
    enabled: true
  }
]

@description('Enable all diagnostic logs/metrics for a Function App resource and send data to target Log Analytics workspace for ingestion.')
resource diagnosticLogsToLogAnalyticsWorkspace 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(workspaceResourceId)) {
  name: webapp.name
  scope: webapp
  properties: {
    workspaceId: workspaceResourceId
    logs: webappLogsEnableAll
    metrics: metricsEnableAll
  }
}
