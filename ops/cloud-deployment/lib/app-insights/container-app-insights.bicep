param containerAppName string
param location string = resourceGroup().location
param analyticsWorkspaceId string = ''
param createApplicationInsights bool = false
param createAlerts bool = false
param actionGroupName string = ''
param actionGroupResourceGroupName string = ''

resource containerApp 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: containerAppName
}

module appInsights '../app-insights/app-insights.bicep' = {
  name: '${containerAppName}-application-insights-module'
  params: {
    location: location
    kind: 'web'
    appInsightsName: 'appi-${containerAppName}'
    applicationType: 'web'
    workspaceResourceId: analyticsWorkspaceId
  }
}

module diagnosticSettings '../app-insights/diagnostics-settings-container.bicep' = if (createApplicationInsights) {
  name: '${containerAppName}-diagnostic-settings-module'
  params: {
    containerAppName: containerAppName
    workspaceResourceId: analyticsWorkspaceId
  }
  dependsOn: [
    appInsights
    containerApp
  ]
}

// Create alerts for the container app if requested
module containerAppAlerts '../monitoring-alerts/container-app-alerts.bicep' = if (createAlerts && createApplicationInsights) {
  name: '${containerAppName}-alerts-module'
  scope: resourceGroup(actionGroupResourceGroupName)
  params: {
    containerAppName: containerAppName
    applicationInsightsName: 'appi-${containerAppName}' // Use the same name as defined in appInsights module
    actionGroupName: actionGroupName
  }
}

output connectionString string = appInsights.outputs.connectionString
output instrumentationKey string = appInsights.outputs.instrumentationKey
