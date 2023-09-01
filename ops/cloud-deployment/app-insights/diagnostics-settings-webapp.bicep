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

var logRetentionPolicy = {
  days: 0
  enabled: true
}

var metricRetentionPolicy = {
  days: 0
  enabled: true
}

var metricsEnableAll = [
  {
    category: 'AllMetrics'
    enabled: true
    retentionPolicy: metricRetentionPolicy
  }
]

var webappLogsEnableAll = [
  {
    category: 'AppServiceAntivirusScanAuditLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }

  {
    category: 'AppServiceHTTPLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }

  {
    category: 'AppServiceConsoleLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }

  {
    category: 'AppServiceAppLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }

  {
    category: 'AppServiceFileAuditLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }

  {
    category: 'AppServiceAuditLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }

  {
    category: 'AppServiceIPSecAuditLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }

  {
    category: 'AppServicePlatformLogs'
    enabled: true
    retentionPolicy: logRetentionPolicy
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
