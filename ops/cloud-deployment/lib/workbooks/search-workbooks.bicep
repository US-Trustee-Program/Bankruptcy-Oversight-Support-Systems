param location string = resourceGroup().location

@description('Resource ID of the Application Insights instance for the webapp.')
param appInsightsResourceId string

param tags object = {}

resource debtorNameSearchWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('debtor-name-search-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Debtor Name Search'
    description: 'Monitor frontend search behavior: filter usage, search volume, and user interaction patterns.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('debtor-name-search.json')
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
