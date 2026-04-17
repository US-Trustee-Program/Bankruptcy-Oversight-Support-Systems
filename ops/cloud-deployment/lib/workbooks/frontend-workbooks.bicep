param location string = resourceGroup().location

@description('Resource ID of the Application Insights instance for the webapp.')
param appInsightsResourceId string

param tags object = {}

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
