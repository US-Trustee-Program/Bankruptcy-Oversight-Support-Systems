param metricAlerts_CosmosAvailabilityTest_name string = 'CosmosAvailabilityTest'
param databaseAccounts_cosmos_ustp_cams_dev_externalid string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/bankruptcy-oversight-support-systems/providers/Microsoft.DocumentDB/databaseAccounts/cosmos-ustp-cams-dev'
param actiongroups_emailappcontributors_externalid string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/rg-cams-app/providers/microsoft.insights/actiongroups/emailappcontributors'

resource metricAlerts_CosmosAvailabilityTest_name_resource 'microsoft.insights/metricAlerts@2018-03-01' = {
  name: metricAlerts_CosmosAvailabilityTest_name
  location: 'global'
  properties: {
    severity: 2
    enabled: true
    scopes: [
      databaseAccounts_cosmos_ustp_cams_dev_externalid
    ]
    evaluationFrequency: 'PT30M'
    windowSize: 'PT1H'
    criteria: {
      allOf: [
        {
          threshold: 100
          name: 'Metric1'
          metricNamespace: 'Microsoft.DocumentDB/databaseAccounts'
          metricName: 'ServiceAvailability'
          operator: 'LessThan'
          timeAggregation: 'Average'
          skipMetricValidation: false
          criterionType: 'StaticThresholdCriterion'
        }
      ]
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
    }
    autoMitigate: true
    targetResourceType: 'Microsoft.DocumentDB/databaseAccounts'
    targetResourceRegion: 'usgovvirginia'
    actions: [
      {
        actionGroupId: actiongroups_emailappcontributors_externalid
        webHookProperties: {}
      }
    ]
  }
}
