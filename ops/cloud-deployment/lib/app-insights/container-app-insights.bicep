param containerAppName string
param location string = resourceGroup().location
param analyticsWorkspaceId string = ''
param createApplicationInsights bool = false
param createAlerts bool = false
param actionGroupName string = ''
param actionGroupResourceGroupName string = ''

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = if (createApplicationInsights) {
  name: 'appi-${containerAppName}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: analyticsWorkspaceId
  }
}

// Create alerts for the container app if requested
module containerAppAlerts '../monitoring-alerts/container-app-alerts.bicep' = if (createAlerts && createApplicationInsights) {
  name: '${containerAppName}-alerts-module'
  scope: resourceGroup(actionGroupResourceGroupName)
  params: {
    containerAppName: containerAppName
    applicationInsightsName: createApplicationInsights ? applicationInsights.name : ''
    actionGroupName: actionGroupName
  }
}

output connectionString string = createApplicationInsights ? applicationInsights.properties.ConnectionString : ''
output instrumentationKey string = createApplicationInsights ? applicationInsights.properties.InstrumentationKey : ''
