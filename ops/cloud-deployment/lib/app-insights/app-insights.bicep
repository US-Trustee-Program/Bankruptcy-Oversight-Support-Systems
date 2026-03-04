param location string = resourceGroup().location

@description('Name of Application Insight resource')
param appInsightsName string

@description('OPTIONAL. Resource id of log analytics workspace which data will be ingested to.')
param workspaceResourceId string = ''

@allowed([ 'web' ])
param applicationType string

@allowed([ 'web' ])
param kind string

param tags object = {}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: kind
  properties: {
    Application_Type: applicationType
    WorkspaceResourceId: !empty(workspaceResourceId) ? workspaceResourceId : null
  }
}

module diagnosticsSettings 'diagnostics-settings-appi.bicep' = {
  name: '${appInsightsName}-diag-settings-module'
  params: {
    appInsightsName: appInsights.name
    workspaceResourceId: workspaceResourceId
  }
}

output id string = appInsights.id
output connectionString string = appInsights.properties.ConnectionString
output instrumentationKey string = appInsights.properties.InstrumentationKey
