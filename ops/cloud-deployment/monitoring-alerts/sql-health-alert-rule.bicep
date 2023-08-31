@description('Alert Rule Name')
param sqlAlertName string

@description('Id of the server the database belongs to')
param serverId string

@description('Name of the database')
param databaseName string

@description('Action Group Name for alerts')
param actionGroupName string

@description('Action Group Resource Group Name for alerts')
param actionGroupResourceGroupName string
@allowed([
  'Microsoft.Sql/servers/databases'
])
@description('Allowed values for targetResourceType')
param targetResourceType string

resource actionGroup 'microsoft.insights/actionGroups@2023-01-01' existing = {
  name: actionGroupName
  scope: resourceGroup(actionGroupResourceGroupName)

}

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
              equals: resourceGroup().name
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
          actionGroupId: actionGroup.id
          webhookProperties: {}
        }
      ]
    }
    enabled: true
  }
}
