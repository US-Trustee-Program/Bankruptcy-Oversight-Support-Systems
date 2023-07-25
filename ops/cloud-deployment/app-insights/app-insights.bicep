param location string = resourceGroup().location
param appInsightsName string
param workspaceResourceId string
param applicationType string


resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  etag: '\"c10081bb-0000-2700-0000-64b6a4b90000\"'
  properties: {
    Application_Type: applicationType
    DisableIpMasking: false
    DisableLocalAuth: true
    Flow_Type: 'Redfield'
    ApplicationId: 'ustp-cams-node-api202307181440'
    ImmediatePurgeDataOn30Days: true
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    Request_Source: 'IbizaAIExtensionEnablementBlade'
    RetentionInDays: 90
    SamplingPercentage: null
    WorkspaceResourceId: workspaceResourceId
  }
}
