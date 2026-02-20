param webappName string

param analyticsWorkspaceId string

param createAlerts bool

param createApplicationInsights bool

param actionGroupName string

param actionGroupResourceGroupName string

resource webapp 'Microsoft.Web/sites@2023-12-01' existing = {
  name: webappName
}

module appInsights './app-insights.bicep' = if (createApplicationInsights) {
  name: '${webappName}-application-insights-module'
  params: {
    location: webapp.location
    kind: 'web'
    appInsightsName: 'appi-${webappName}'
    applicationType: 'web'
    workspaceResourceId: analyticsWorkspaceId
  }
}

module diagnosticSettings './diagnostics-settings-webapp.bicep' = if (createApplicationInsights) {
  name: '${webappName}-diagnostic-settings-module'
  params: {
    webappName: webappName
    workspaceResourceId: analyticsWorkspaceId
  }
  dependsOn: [
    appInsights
    webapp
  ]
}

module healthAlertRule '../monitoring-alerts/metrics-alert-rule.bicep' = if (createAlerts) {
  name: '${webappName}-healthcheck-alert-rule-module'
  params: {
    alertName: '${webappName}-health-check-alert'
    appId: webapp.id
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
  name: '${webappName}-http-error-alert-rule-module'
  params: {
    alertName: '${webappName}-http-error-alert'
    appId: webapp.id
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
