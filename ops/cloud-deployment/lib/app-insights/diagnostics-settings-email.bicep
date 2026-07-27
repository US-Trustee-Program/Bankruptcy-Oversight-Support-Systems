/*
  Enable email send/delivery diagnostic logs for the ACS Communication Services resource
  used to send trustee change notification emails.

  EmailSendMailOperational      - records that a send was accepted/initiated
  EmailStatusUpdateOperational  - downstream per-recipient delivery result (bounce/reject detail)
  EmailUserEngagementOperational - opens/clicks; disabled, matches userEngagementTracking: 'Disabled'
    on the linked email domain resource (see email-communication-services.bicep)

  Metrics category is 'Traffic' - Communication Services does not support the 'AllMetrics' alias
  used by some other resource types; confirmed via `az monitor diagnostic-settings categories list`
  against ustp-cams-comms.
*/
@description('Name of the diagnostic setting.')
param settingName string

@description('Name of the Communication Services resource that sends email.')
param communicationServiceName string

@description('Resource id of the Log Analytics workspace to send diagnostic data to.')
param analyticsWorkspaceId string

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' existing = {
  name: communicationServiceName
}

resource setting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: settingName
  scope: communicationService
  properties: {
    workspaceId: analyticsWorkspaceId
    logs: [
      {
        category: 'EmailSendMailOperational'
        categoryGroup: null
        enabled: true
      }
      {
        category: 'EmailStatusUpdateOperational'
        categoryGroup: null
        enabled: true
      }
      {
        category: 'EmailUserEngagementOperational'
        categoryGroup: null
        enabled: false
      }
    ]
    metrics: [
      {
        timeGrain: null
        enabled: true
        category: 'Traffic'
      }
    ]
  }
}
