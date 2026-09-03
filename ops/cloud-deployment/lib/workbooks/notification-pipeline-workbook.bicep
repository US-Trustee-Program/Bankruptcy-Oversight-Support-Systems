param location string = resourceGroup().location

@description('Branch-unique name, folded into the workbook\'s guid() seed to prevent collisions across branches sharing this resource group.')
param stackName string

@description('Resource ID of the dataflows function app\'s Application Insights instance.')
param dataflowsAppInsightsResourceId string

@description('Resource ID of the API function app\'s Application Insights instance.')
param apiAppInsightsResourceId string

@description('Resource ID of the shared Log Analytics workspace hosting ACS diagnostic logs (ACSEmailStatusUpdateOperational).')
param analyticsWorkspaceResourceId string

param tags object = {}

var apiAppInsightsName = last(split(apiAppInsightsResourceId, '/'))
var analyticsWorkspaceName = last(split(analyticsWorkspaceResourceId, '/'))

var workbookJson = replace(
  replace(
    loadTextContent('trustee-notification-pipeline.json'),
    '{NodeApiAppInsights:name}',
    apiAppInsightsName
  ),
  '{LogAnalyticsWorkspace:name}',
  analyticsWorkspaceName
)

resource notificationPipelineWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-notification-pipeline-workbook', resourceGroup().id, stackName)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Trustee Notification Pipeline'
    description: 'Visibility into the trustee-change-notification / ACS bounce-poll pipeline: send volume, bounce-poll job health, and per-email bounce detail.'
    category: 'workbook'
    sourceId: dataflowsAppInsightsResourceId
    serializedData: workbookJson
  }
}
