@description('Alert Rule Name')
param alertRuleName string

@description('Application Insights resource ID to query')
param appInsightsResourceId string

@description('Action Group ID for alert notifications')
param actionGroupId string

@description('KQL query to run')
param query string

@description('Threshold value')
param threshold int

@description('Evaluation frequency in minutes (5, 10, 15, 30, 60, or 1440)')
@allowed([5, 10, 15, 30, 60, 1440])
param evaluationFrequencyMinutes int = 15

@description('Window size in minutes (5, 10, 15, 30, 60, 120, 180, 240, 300, 360, or 1440)')
@allowed([5, 10, 15, 30, 60, 120, 180, 240, 300, 360, 1440])
param windowSizeMinutes int = 30

@description('Operator for threshold comparison')
@allowed(['GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual', 'Equal'])
param operator string = 'GreaterThan'

@description('Severity level (0=Critical, 1=Error, 2=Warning, 3=Informational, 4=Verbose)')
@allowed([0, 1, 2, 3, 4])
param severity int = 2

@description('Alert description')
param description string

resource scheduledQueryAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: alertRuleName
  location: resourceGroup().location
  properties: {
    description: description
    severity: severity
    enabled: true
    evaluationFrequency: 'PT${evaluationFrequencyMinutes}M'
    scopes: [
      appInsightsResourceId
    ]
    windowSize: 'PT${windowSizeMinutes}M'
    criteria: {
      allOf: [
        {
          query: query
          timeAggregation: 'Maximum'
          metricMeasureColumn: 'p95Latency'
          operator: operator
          threshold: threshold
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        actionGroupId
      ]
    }
    autoMitigate: true
  }
}

output alertRuleId string = scheduledQueryAlert.id
