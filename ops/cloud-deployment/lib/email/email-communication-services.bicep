@description('Name of the Email Communication Services resource')
param emailServiceName string

param location string = 'global'

@description('Data location for email service')
@allowed([
  'usgov'
])
param dataLocation string = 'usgov'

param tags object = {}

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: emailServiceName
  location: location
  tags: tags
  properties: {
    dataLocation: dataLocation
  }
}

resource azureManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: location
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

output emailServiceId string = emailService.id
output domainResourceId string = azureManagedDomain.id
output senderAddress string = 'DoNotReply@${azureManagedDomain.properties.mailFromSenderDomain}'
