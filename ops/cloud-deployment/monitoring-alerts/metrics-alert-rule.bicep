param alertName string = 'HTTPErrorAlert-Node-Api'
param appId string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/rg-cams-app/providers/Microsoft.Web/sites/ustp-cams-node-api'
param actionGroupId string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/rg-analytics/providers/microsoft.insights/actiongroups/emaildevelopmentteam'

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


resource alertRule 'microsoft.insights/metricAlerts@2018-03-01' = {
  name: alertName
  location: 'global'
  properties: {
    severity: severity
    enabled: true
    scopes: [
      appId
    ]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
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
        actionGroupId: actionGroupId
        webHookProperties: {}
      }
    ]
  }
}
