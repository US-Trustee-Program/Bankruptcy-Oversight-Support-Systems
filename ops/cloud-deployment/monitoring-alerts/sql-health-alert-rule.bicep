param activitylogalerts_SqlHealthAlertTest_name string = 'SqlHealthAlertTest'
param servers_sql_ustp_cams_externalid string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/bankruptcy-oversight-support-systems/providers/Microsoft.Sql/servers/sql-ustp-cams'
param actiongroups_emailappcontributors_externalid string = '/subscriptions/729f9083-9edf-4269-919f-3f05f7a0ab20/resourceGroups/rg-cams-app/providers/microsoft.insights/actiongroups/emailappcontributors'

resource activitylogalerts_SqlHealthAlertTest_name_resource 'microsoft.insights/activitylogalerts@2020-10-01' = {
  name: activitylogalerts_SqlHealthAlertTest_name
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
              equals: '${servers_sql_ustp_cams_externalid}/databases/ACMS_REP_SUB'
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
          actionGroupId: actiongroups_emailappcontributors_externalid
          webhookProperties: {}
        }
      ]
    }
    enabled: true
  }
}
