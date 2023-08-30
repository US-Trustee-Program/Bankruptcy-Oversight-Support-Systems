@description('Alert Rule Name')
param alertName string

@description('Id of the application or resource this metric alert is for')
param appId string

@description('Action Group Name for alerts')
param actionGroupName string

@description('Action Group Resource Group Name for alerts')
param actionGroupResourceGroupName string

@allowed([
  'Total'
  'Maximum'
  'Average'
])
@description('Allowed values for time Aggregation')
param timeAggregation string


@allowed([
  'GreaterThan'
  'LessThan'
  'GreaterThanOrEqual'
  'LessThanOrEqual'
  'Equal'
])
@description('Allowed values for operator')
param operator string

@allowed([
  'Microsoft.Web/sites'
  'Microsoft.Sql/servers/databases'
  'Microsoft.DocumentDB/databaseAccounts'
])
@description('Allowed values for targetResourceType')
param targetResourceType string

@allowed([
  'Http5xx'
  'storage_percent'
  'ServiceAvailability'
  'HealthCheckStatus'
  'storage_percent'
])
@description('Allowed values for metricName')
param metricName string

@description('Values for severity 0 = Critical, 1 = Error, 2 = Warning, 3 = Informational, 4 = Verbose')
param severity int

@description('Values for threshold')
param threshold int

@description('Values for Evaluation Frequency')
param evaluationFrequency string = 'PT15M' //Default to 15M for most Alerts, Servicevailability is an exception requires 1h+

@description('Values for evaluation Window Size')
param windowSize string = 'PT30M' //Default to 30M for most Alerts,  Servicevailability is an exception requires 1h+

resource actionGroup 'microsoft.insights/actionGroups@2023-01-01' existing = {
  name: actionGroupName
  scope: resourceGroup(actionGroupResourceGroupName)

}
resource alertRule 'microsoft.insights/metricAlerts@2018-03-01' = {
  name: alertName
  location: 'global'
  properties: {
    severity: severity
    enabled: true
    scopes: [
      appId
    ]
    evaluationFrequency: evaluationFrequency
    windowSize: windowSize
    criteria: {
      allOf: [
        {
          threshold: threshold
          name: 'Metric1'
          metricNamespace: targetResourceType
          metricName: metricName
          operator: operator
          timeAggregation: timeAggregation
          skipMetricValidation: false
          criterionType: 'StaticThresholdCriterion'
        }
      ]
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
    }
    autoMitigate: true
    targetResourceType: targetResourceType
    targetResourceRegion: 'usgovvirginia'
    actions: [
      {
        actionGroupId: actionGroup.id
        webHookProperties: {}
      }
    ]
  }
}
