param alertName string = 'HealthCheckFailedTest'
param resourceId string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/rg-cams-app/providers/Microsoft.Web/sites/ustp-cams-node-api'
param actionGroupId string = '/subscriptions/729F9083-9EDF-4269-919F-3F05F7A0AB20/resourceGroups/rg-analytics/providers/microsoft.insights/actionGroups/EmailDevelopmentTeam'
param appType string = 'webapp'

resource metricAlert 'microsoft.insights/metricAlerts@2018-03-01' = {
  name: '${alertName}-${appType}-alert'
  location: 'global'
  properties: {
    severity: 2
    enabled: true
    scopes: [
      resourceId
    ]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    criteria: {
      allOf: [
        {
          threshold: 100
          name: 'Metric1'
          metricNamespace: 'Microsoft.Web/sites'
          metricName: 'HealthCheckStatus'
          operator: 'LessThan'
          timeAggregation: 'Average'
          skipMetricValidation: false
          criterionType: 'StaticThresholdCriterion'
        }
      ]
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
    }
    autoMitigate: true
    targetResourceType: 'Microsoft.Web/sites'
    targetResourceRegion: 'usgovvirginia'
    actions: [
      {
        actionGroupId: actionGroupId
        webHookProperties: {}
      }
    ]
  }
}
