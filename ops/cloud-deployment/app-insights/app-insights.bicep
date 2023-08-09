param location string = resourceGroup().location
param appInsightsName string
param workspaceResourceId string
param applicationType string


resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: applicationType
    DisableIpMasking: false
    DisableLocalAuth: true
    Flow_Type: 'Redfield'
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

output id string = appInsights.id
output connectionString string = appInsights.properties.ConnectionString
output instrumentationKey string = appInsights.properties.InstrumentationKey
