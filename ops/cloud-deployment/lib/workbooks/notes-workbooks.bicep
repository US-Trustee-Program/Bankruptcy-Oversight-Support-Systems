param location string = resourceGroup().location

@description('Resource ID of the Application Insights instance for the backend API function app.')
param apiAppInsightsResourceId string

@description('Resource ID of the Application Insights instance for the dataflows function app.')
param dataflowsAppInsightsResourceId string

param tags object = {}

resource trusteeNotesWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-notes-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Trustee Notes Analytics'
    description: 'Monitor trustee notes adoption rate, active usage, and user engagement by oversight role.'
    category: 'workbook'
    sourceId: apiAppInsightsResourceId
    serializedData: replace(
      replace(
        loadTextContent('trustee-notes.json'),
        '__PLACEHOLDER_API_APP_INSIGHTS_RESOURCE_ID__',
        apiAppInsightsResourceId
      ),
      '__PLACEHOLDER_DATAFLOWS_APP_INSIGHTS_RESOURCE_ID__',
      dataflowsAppInsightsResourceId
    )
  }
}
