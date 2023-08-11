param location string = resourceGroup().location

@description('Name of Application Insight resource')
param appInsightsName string

@description('OPTIONAL. Resource id of log analytics workspace which data will be ingested to.')
param workspaceResourceId string = ''

@allowed([ 'web' ])
param applicationType string

@allowed([ 'web' ])
param kind string

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: kind
  properties: {
    Application_Type: applicationType
    WorkspaceResourceId: !empty(workspaceResourceId) ? workspaceResourceId : null
  }
}

var logRetentionPolicy = {
  days: 30
  enabled: true
}

var metricRetentionPolicy = {
  days: 30
  enabled: true
}

@description('Enable all diagnostic logs/metrics for an Application Insight resource and send data to target Log Analytics workspace for ingestion.')
resource diagnosticLogsToLogAnalyticsWorkspace 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(workspaceResourceId)) {
  name: appInsights.name
  scope: appInsights
  properties: {
    workspaceId: workspaceResourceId
    logs: [
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
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: metricRetentionPolicy
      }
    ]
  }
}

output id string = appInsights.id
output connectionString string = appInsights.properties.ConnectionString
