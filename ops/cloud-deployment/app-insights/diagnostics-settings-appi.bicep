/*
  Enable all logs and metrics for Azure Application Insights resource

  Azure provides the following destination options
  - Send to Log Analytics workspace   [SUPPORTED]
  - Archive to a storage account      [NOT YET SUPPORTED]
  - Stream to an event hub            [NOT YET SUPPORTED]
  - Send to partner solution          [NOT YET SUPPORTED]
*/
@description('Name of Application Insight resource')
param appInsightsName string

@description('OPTIONAL. Resource id of log analytics workspace which data will be ingested to.')
param workspaceResourceId string = '' // For "Send to Log Analytics workspace"

resource appInsight 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
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

var applicationInsightsLogsEnableAll = [
  {
    category: 'AppAvailabilityResults'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppBrowserTimings'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppEvents'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppMetrics'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppDependencies'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppExceptions'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppPageViews'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppPerformanceCounters'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppRequests'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppSystemEvents'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
  {
    category: 'AppTraces'
    enabled: true
    retentionPolicy: logRetentionPolicy
  }
]

@description('Enable all diagnostic logs/metrics for an Application Insight resource and send data to target Log Analytics workspace for ingestion.')
resource diagnosticLogsToLogAnalyticsWorkspace 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(workspaceResourceId)) {
  name: appInsight.name
  scope: appInsight
  properties: {
    workspaceId: workspaceResourceId
    logs: applicationInsightsLogsEnableAll
    metrics: metricsEnableAll
  }
}
