param sqlAlertName string
param serverId string
param actionGroupId string

resource alertRule 'microsoft.insights/activitylogalerts@2020-10-01' = {
  name: sqlAlertName
  location: 'global'
  properties: {
    scopes: [
      '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20'
    ]
    condition: {
      allOf: [
        {
          field: 'category'
          equals: 'ResourceHealth'
        }
        {
          anyOf: [
            {
              field: 'resourceGroup'
              equals: 'bankruptcy-oversight-support-systems'
            }
          ]
        }
        {
          anyOf: [
            {
              field: 'resourceId'
              equals: '${serverId}/databases/ACMS_REP_SUB'
            }
          ]
        }
        {
          anyOf: [
            {
              field: 'resourceType'
              equals: 'Microsoft.Sql/servers/databases'
            }
          ]
        }
      ]
    }
    actions: {
      actionGroups: [
        {
          actionGroupId: actionGroupId
          webhookProperties: {}
        }
      ]
    }
    enabled: true
  }
}
