param functionAppName string

param analyticsWorkspaceId string

param createAlerts bool

param createApplicationInsights bool

param actionGroupName string

param actionGroupResourceGroupName string

param tags object = {}

resource functionApp 'Microsoft.Web/sites@2023-12-01' existing = {
  name: functionAppName
}

module appInsights '../app-insights/app-insights.bicep' = if (createApplicationInsights)  {
  name: '${functionAppName}-application-insights-module'
  params: {
    location: functionApp.location
    kind: 'web'
    appInsightsName: 'appi-${functionAppName}'
    applicationType: 'web'
    workspaceResourceId: analyticsWorkspaceId
    tags: tags
  }
}

module diagnosticSettings '../app-insights/diagnostics-settings-func.bicep' = if (createApplicationInsights) {
  name: '${functionAppName}-diagnostic-settings-module'
  params: {
    functionAppName: functionAppName
    workspaceResourceId: analyticsWorkspaceId
  }
  dependsOn: [
    appInsights
    functionApp
  ]
}

module healthAlertRule '../monitoring-alerts/metrics-alert-rule.bicep' = if (createAlerts) {
  name: '${functionAppName}-healthcheck-alert-rule-module'
  params: {
    alertName: '${functionAppName}-health-check-alert'
    appId: functionApp.id
    timeAggregation: 'Average'
    operator: 'LessThan'
    targetResourceType: 'Microsoft.Web/sites'
    metricName: 'HealthCheckStatus'
    severity: 2
    threshold: 100
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
  }
}

module httpAlertRule '../monitoring-alerts/metrics-alert-rule.bicep' = if (createAlerts) {
  name: '${functionAppName}-http-error-alert-rule-module'
  params: {
    alertName: '${functionAppName}-http-error-alert'
    appId: functionApp.id
    timeAggregation: 'Total'
    operator: 'GreaterThanOrEqual'
    targetResourceType: 'Microsoft.Web/sites'
    metricName: 'Http5xx'
    severity: 1
    threshold: 1
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
  }
}

output connectionString string = createApplicationInsights ? appInsights.outputs.connectionString : ''
output id string = createApplicationInsights ? appInsights.outputs.id : ''
