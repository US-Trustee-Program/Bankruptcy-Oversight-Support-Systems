param location string = resourceGroup().location
param appInsightsName string
param workspaceResourceId string
param applicationType string


resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  etag: 'string'
  properties: {
    Application_Type: applicationType
    DisableIpMasking: false
    DisableLocalAuth: true
    Flow_Type: 'Bluefield'
    ForceCustomerStorageForProfiler: false
    HockeyAppId: 'string'
    ImmediatePurgeDataOn30Days: true
    IngestionMode: 'string'
    publicNetworkAccessForIngestion: 'string'
    publicNetworkAccessForQuery: 'string'
    Request_Source: 'rest'
    RetentionInDays: 30
    SamplingPercentage: json('0.5')
    WorkspaceResourceId: workspaceResourceId
  }
}
