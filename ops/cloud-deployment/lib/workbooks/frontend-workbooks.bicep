param location string = resourceGroup().location

@description('Resource ID of the Application Insights instance for the webapp.')
param appInsightsResourceId string

@description('Resource ID of the Application Insights instance for node-api.')
param nodeApiAppInsightsResourceId string

param tags object = {}

var nodeApiAppInsightsName = last(split(nodeApiAppInsightsResourceId, '/'))

resource trusteeDistrictFilterMetricsWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-district-filter-metrics-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Trustee District Filter Metrics'
    description: 'Success metrics for CAMS-691: district filter usage rates, default clear frequency, trustee count distribution, and page load time performance.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('trustee-district-filter-metrics.json')
  }
}

resource trusteeNameManagementMetricsWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-name-management-metrics-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Trustee Name Management Metrics'
    description: 'Sort-by-last-name adoption and post-launch name correction patterns for migrated vs non-migrated trustees.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: replace(
      loadTextContent('trustee-name-management-metrics.json'),
      '{NodeApiAppInsights:name}',
      nodeApiAppInsightsName
    )
  }
}

resource trusteeCaseDetailInfoEngagementWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-case-detail-info-engagement-workbook', resourceGroup().id)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Trustee Case Detail Info Engagement'
    description: 'Track adoption of the trustee case detail panel: panel views, profile navigations, Zoom link clicks, and copy Zoom info clicks.'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('trustee-case-detail-info-engagement.json')
  }
}
