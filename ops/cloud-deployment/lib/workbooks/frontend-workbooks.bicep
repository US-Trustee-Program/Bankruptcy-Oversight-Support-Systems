param location string = resourceGroup().location

@description('Branch-unique name, folded into each workbook\'s guid() seed to prevent collisions across branches sharing this resource group.')
param stackName string

@description('Resource ID of the Application Insights instance for the webapp.')
param appInsightsResourceId string

@description('Resource ID of the Application Insights instance for node-api.')
param nodeApiAppInsightsResourceId string

param tags object = {}

var nodeApiAppInsightsName = last(split(nodeApiAppInsightsResourceId, '/'))

resource trusteeDistrictFilterMetricsWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('trustee-district-filter-metrics-workbook', resourceGroup().id, stackName)
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
  name: guid('trustee-name-management-metrics-workbook', resourceGroup().id, stackName)
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
  name: guid('trustee-case-detail-info-engagement-workbook', resourceGroup().id, stackName)
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

resource docketFilterMetricsWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('docket-filter-metrics-workbook', resourceGroup().id, stackName)
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Docket Filter Usage'
    description: 'Usage metrics for CAMS-850: relative usage frequency, docket entry count distribution, and Court Docket panel adoption rate across the four Court Docket filters (Text Search, Document Number, Summary, Date Range).'
    category: 'workbook'
    sourceId: appInsightsResourceId
    serializedData: loadTextContent('docket-filter-metrics.json')
  }
}
