param containerAppName string
param applicationInsightsName string = ''
param actionGroupName string = ''

// This is a placeholder for container app alerts
// For now, we'll keep this simple and can enhance later
// The main function app alerts can be used as reference

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' existing = if (!empty(actionGroupName)) {
  name: actionGroupName
}

// Basic availability alert for the container app
resource containerAppAvailabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (!empty(applicationInsightsName) && !empty(actionGroupName)) {
  name: 'ContainerApp-${containerAppName}-Availability'
  location: 'global'
  properties: {
    description: 'Alert when container app availability drops below threshold'
    severity: 2
    enabled: true
    scopes: [
      resourceId('Microsoft.Insights/components', applicationInsightsName)
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'AvailabilityMetric'
          metricName: 'availabilityResults/availabilityPercentage'
          operator: 'LessThan'
          threshold: 95
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: !empty(actionGroupName) ? [
      {
        actionGroupId: actionGroup.id
      }
    ] : []
  }
}
