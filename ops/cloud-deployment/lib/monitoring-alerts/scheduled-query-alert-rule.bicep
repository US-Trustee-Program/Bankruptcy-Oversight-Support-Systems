@description('Alert Rule Name')
param alertRuleName string

@description('Resource ID of the Application Insights instance or Log Analytics workspace to query')
param logQueryScopeResourceId string

@description('Action Group ID for alert notifications')
param actionGroupId string

@description('KQL query to run')
param query string

@description('Threshold value')
param threshold int

@description('How the query results are aggregated. Use Count for a row-count alert (e.g. counting failure rows); Maximum (default) matches prior metric-style callers of this module.')
@allowed(['Count', 'Maximum', 'Minimum', 'Average', 'Total'])
param timeAggregation string = 'Maximum'

@description('Column to measure when timeAggregation is not Count. REQUIRED (must be non-empty) whenever timeAggregation is not Count -- omitting it will deploy an alert that fails or behaves unexpectedly, since the underlying scheduledQueryRules criteria has no metricMeasureColumn to evaluate. Ignored (and unnecessary) when timeAggregation is Count, since Count summarizes rows rather than measuring a column.')
param metricMeasureColumn string = ''

@description('Optional dimensions to split the alert by (one alert instance per unique combination of dimension values). When set, the query must project a column matching each dimension name, and the Common Alert Schema payload sent to actions will include that dimension\'s value directly -- required if a downstream action (e.g. a webhook/Function) needs to know which specific row(s) triggered the alert, not just that the aggregate threshold was crossed.')
param dimensions array = []

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
param alertDescription string

resource scheduledQueryAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: alertRuleName
  location: resourceGroup().location
  properties: {
    description: alertDescription
    severity: severity
    enabled: true
    evaluationFrequency: 'PT${evaluationFrequencyMinutes}M'
    scopes: [
      logQueryScopeResourceId
    ]
    windowSize: 'PT${windowSizeMinutes}M'
    criteria: {
      allOf: [
        union(
          {
            query: query
            timeAggregation: timeAggregation
            operator: operator
            threshold: threshold
            failingPeriods: {
              numberOfEvaluationPeriods: 1
              minFailingPeriodsToAlert: 1
            }
          },
          timeAggregation == 'Count' ? {} : { metricMeasureColumn: metricMeasureColumn },
          empty(dimensions) ? {} : { dimensions: dimensions }
        )
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
