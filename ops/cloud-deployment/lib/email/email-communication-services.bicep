@description('Name of the Email Communication Services resource')
param emailServiceName string

param location string = 'global'

@description('Data location for email service')
@allowed([
  'usgov'
])
param dataLocation string = 'usgov'

param tags object = {}

@description('Custom domain FQDN (e.g. notifications.example.gov). Leave empty to use Azure-managed domain.')
param customDomain string = ''

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: emailServiceName
  location: location
  tags: tags
  properties: {
    dataLocation: dataLocation
  }
}

resource azureManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (empty(customDomain)) {
  parent: emailService
  name: 'AzureManagedDomain'
  location: location
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource customerManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (!empty(customDomain)) {
  parent: emailService
  name: !empty(customDomain) ? customDomain : 'placeholder'
  location: location
  properties: {
    domainManagement: 'CustomerManaged'
    userEngagementTracking: 'Disabled'
  }
}

output emailServiceId string = emailService.id
output domainResourceId string = empty(customDomain) ? azureManagedDomain.id : customerManagedDomain.id
output senderAddress string = empty(customDomain) ? 'DoNotReply@${azureManagedDomain.properties.mailFromSenderDomain}' : 'DoNotReply@${customDomain}'
