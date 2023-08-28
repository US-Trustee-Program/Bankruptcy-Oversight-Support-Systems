param metricAlerts_SQLSpaceLowTest_name string = 'SQLSpaceLowTest'
param servers_sql_ustp_cams_externalid string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/bankruptcy-oversight-support-systems/providers/Microsoft.Sql/servers/sql-ustp-cams'
param actiongroups_emailappcontributors_externalid string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/rg-cams-app/providers/microsoft.insights/actiongroups/emailappcontributors'

resource metricAlerts_SQLSpaceLowTest_name_resource 'microsoft.insights/metricAlerts@2018-03-01' = {
  name: metricAlerts_SQLSpaceLowTest_name
  location: 'global'
  properties: {
    description: 'Sql used space is at 85%'
    severity: 2
    enabled: true
    scopes: [
      '${servers_sql_ustp_cams_externalid}/databases/ACMS_REP_SUB'
    ]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    criteria: {
      allOf: [
        {
          threshold: 85
          name: 'Metric1'
          metricNamespace: 'Microsoft.Sql/servers/databases'
          metricName: 'storage_percent'
          operator: 'GreaterThan'
          timeAggregation: 'Maximum'
          skipMetricValidation: false
          criterionType: 'StaticThresholdCriterion'
        }
      ]
      'odata.type': 'Microsoft.Azure.Monitor.MultipleResourceMultipleMetricCriteria'
    }
    autoMitigate: true
    targetResourceType: 'Microsoft.Sql/servers/databases'
    targetResourceRegion: 'usgovvirginia'
    actions: [
      {
        actionGroupId: actiongroups_emailappcontributors_externalid
        webHookProperties: {}
      }
    ]
  }
}
