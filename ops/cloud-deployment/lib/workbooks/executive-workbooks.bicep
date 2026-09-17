param location string = resourceGroup().location

@description('Branch-unique name, folded into each workbook\'s guid() seed to prevent collisions across branches sharing this resource group.')
param stackName string

@description('Resource ID of the Application Insights instance for the webapp.')
param appInsightsResourceId string

@description('Resource ID of the Application Insights instance for dataflows.')
param dataflowsAppInsightsResourceId string

param tags object = {}

// Extract App Insights name from resource ID for use in KQL app() function
var dataflowsAppInsightsName = last(split(dataflowsAppInsightsResourceId, '/'))

resource executiveOverviewWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('executive-overview-workbook', resourceGroup().id, stackName)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'CAMS Executive Usage Overview'
    description: 'Stakeholder-facing single view of user growth, engaged vs. occasional users, tab-level feature adoption, and reliability, built from existing telemetry with no new instrumentation.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: replace(
      loadTextContent('executive-overview.json'),
      '{DataflowsAppInsights:name}',
      dataflowsAppInsightsName
    )
  }
}
