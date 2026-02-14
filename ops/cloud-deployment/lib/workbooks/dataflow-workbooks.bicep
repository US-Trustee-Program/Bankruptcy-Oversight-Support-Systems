param location string = resourceGroup().location

@description('Resource ID of the Application Insights instance for the dataflows function app.')
param appInsightsResourceId string

resource operationsWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('dataflow-operations-workbook', resourceGroup().id)
  location: location
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
  kind: 'shared'
  properties: {
    displayName: 'Dataflow Troubleshooting'
    description: 'Investigate dataflow failures, partial failures, and error patterns.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('dataflow-troubleshooting.json')
  }
}
