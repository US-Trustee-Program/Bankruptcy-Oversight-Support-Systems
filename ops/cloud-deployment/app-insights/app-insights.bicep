param location string = resourceGroup().location
param appInsightsName string
param workspaceResourceId string
param applicationType string
param kind string

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: kind
  properties: {
    Application_Type: applicationType
    WorkspaceResourceId: workspaceResourceId

  }
}

resource diagnosticLogs 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: appInsights.name
  scope: appInsights
  properties: {
    workspaceId: workspaceResourceId
    logs: [
      {
        category: 'AppAvailabilityResults'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppBrowserTimings'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppEvents'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppMetrics'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppDependencies'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppExceptions'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppPageViews'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppPerformanceCounters'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppRequests'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppSystemEvents'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
      {
        category: 'AppTraces'
        categoryGroup: null
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          days: 30
          enabled: true
        }
      }
    ]
  }
}

output id string = appInsights.id
output connectionString string = appInsights.properties.ConnectionString
output instrumentationKey string = appInsights.properties.InstrumentationKey
