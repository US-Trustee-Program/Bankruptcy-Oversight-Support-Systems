param sqlAlertName string
param serverId string
param actionGroupId string
param resourceGroup string
param databaseName string

@allowed([
  'Microsoft.Sql/servers/databases'
])
@description('Allowed values for targetResourceType')
param targetResourceType string

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
              equals: resourceGroup
            }
          ]
        }
        {
          anyOf: [
            {
              field: 'resourceId'
              equals: '${serverId}/databases/${databaseName}'
            }
          ]
        }
        {
          anyOf: [
            {
              field: 'resourceType'
              equals: targetResourceType
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
