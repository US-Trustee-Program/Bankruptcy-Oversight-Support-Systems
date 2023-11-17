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

var metricsEnableAll = [
  {
    category: 'AllMetrics'
    enabled: true
  }
]

var applicationInsightsLogsEnableAll = [
  {
    category: 'AppAvailabilityResults'
    enabled: true
  }
  {
    category: 'AppBrowserTimings'
    enabled: true
  }
  {
    category: 'AppEvents'
    enabled: true

  }
  {
    category: 'AppMetrics'
    enabled: true
  }
  {
    category: 'AppDependencies'
    enabled: true
  }
  {
    category: 'AppExceptions'
    enabled: true
  }
  {
    category: 'AppPageViews'
    enabled: true
  }
  {
    category: 'AppPerformanceCounters'
    enabled: true
  }
  {
    category: 'AppRequests'
    enabled: true
  }
  {
    category: 'AppSystemEvents'
    enabled: true
  }
  {
    category: 'AppTraces'
    enabled: true
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
