param location string = resourceGroup().location

@description('Branch-unique name, folded into the workbook\'s guid() seed to prevent collisions across branches sharing this resource group.')
param stackName string

@description('Resource ID of the Application Insights instance for the API function app, which receives the "CAMS Sign-In" events.')
param appInsightsResourceId string

param tags object = {}

resource peopleUsageWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('people-usage-workbook', resourceGroup().id, stackName)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'CAMS People Usage'
    description: 'On-demand list of people who signed in to CAMS in a time range, by work email, with roles, offices, regions, and last-used date. Shows email addresses; access requires product-owner approval.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('people-usage.json')
  }
}
