param location string = resourceGroup().location

@description('Resource ID of the Application Insights instance for the webapp.')
param appInsightsResourceId string

resource debtorNameSearchWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('debtor-name-search-workbook', resourceGroup().id)
  location: location
  kind: 'shared'
  properties: {
    displayName: 'Debtor Name Search'
    description: 'Monitor frontend search behavior: filter usage, search volume, and user interaction patterns.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('debtor-name-search.json')
  }
}
