param location string = resourceGroup().location
param appInsightsName string
param workspaceResourceId string
param applicationType string
param kind string

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: kind
  properties: {
    Application_Type: applicationType
    WorkspaceResourceId: workspaceResourceId
  }
}

output id string = appInsights.id
output connectionString string = appInsights.properties.ConnectionString
output instrumentationKey string = appInsights.properties.InstrumentationKey
