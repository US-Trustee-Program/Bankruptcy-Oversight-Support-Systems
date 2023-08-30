param actionGroupName string = 'EmailDevelopmentTeam'

resource actionGroup 'microsoft.insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'Global'
  properties: {
    groupShortName: 'Email Team'
    enabled: true
    emailReceivers: [
      {
        name: 'EmailArthur-EmailAction-'
        emailAddress: 'amorrow@flexion.us'
        useCommonAlertSchema: true
      }
      // {
      //   name: 'EmailMike_-EmailAction-'
      //   emailAddress: 'mly@flexion.us'
      //   useCommonAlertSchema: true
      // }
      // {
      //   name: 'EmailFritz_-EmailAction-'
      //   emailAddress: 'fmadden@flexion.us'
      //   useCommonAlertSchema: true
      // }
      // {
      //   name: 'EmailJames_-EmailAction-'
      //   emailAddress: 'jbrooks@flexion.us'
      //   useCommonAlertSchema: true
      // }
      // {
      //   name: 'EmailSwathi_-EmailAction-'
      //   emailAddress: 'sdarbha@flexion.us'
      //   useCommonAlertSchema: true
      // }
    ]
    smsReceivers: []
    webhookReceivers: []
    eventHubReceivers: []
    itsmReceivers: []
    azureAppPushReceivers: []
    automationRunbookReceivers: []
    voiceReceivers: []
    logicAppReceivers: []
    azureFunctionReceivers: []
    armRoleReceivers: []
  }
}
output actionGroupId string = actionGroup.id
