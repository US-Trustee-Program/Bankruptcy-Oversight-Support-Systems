@description('Name of the admin-notification action group')
param actionGroupName string

@description('Email address to notify on ACS email delivery failures')
@secure()
param adminEmail string

param tags object = {}

resource actionGroup 'microsoft.insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'Global'
  tags: tags
  properties: {
    groupShortName: 'CAMS Admin'
    enabled: true
    emailReceivers: [
      {
        name: 'CAMSAdministrator'
        emailAddress: adminEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

output actionGroupId string = actionGroup.id
