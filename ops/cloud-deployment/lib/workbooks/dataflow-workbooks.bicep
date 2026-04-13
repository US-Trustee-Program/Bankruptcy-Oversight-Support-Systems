param location string = resourceGroup().location

@description('Resource ID of the Application Insights instance for the dataflows function app.')
param appInsightsResourceId string

param tags object = {}

resource operationsWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('dataflow-operations-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Dataflow Operations'
    description: 'Monitor dataflow sync and migration health, throughput, and instance distribution.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('dataflow-operations.json')
  }
}

resource troubleshootingWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('dataflow-troubleshooting-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Dataflow Troubleshooting'
    description: 'Investigate dataflow failures, partial failures, and error patterns.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('dataflow-troubleshooting.json')
  }
}

resource trusteeNotesEngagementWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-notes-engagement-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Trustee Notes Engagement'
    description: 'Track trustee notes adoption, active usage, and user engagement over time.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('trustee-notes-engagement.json')
  }
}

resource trusteeDueDateMetricsWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-due-date-metrics-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Trustee Due Date Metrics'
    description: 'Tracks the completeness of key date entries for Chapter 7 trustee appointments.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('trustee-due-date-metrics.json')
  }
}

resource trusteeMatchingAnalyticsWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-matching-analytics-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Trustee Matching Analytics'
    description: 'Comprehensive metrics tracking trustee matching performance across all 5 matching scenarios (Stories 1-5).'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('trustee-matching-analytics.json')
  }
}
