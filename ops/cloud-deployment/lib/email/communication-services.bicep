@description('Name of the Azure Communication Services resource')
param communicationServiceName string

param location string = 'global'

@description('Data location for communication service')
@allowed([
  'United States'
])
param dataLocation string = 'United States'

@description('Resource ID of the email domain to link')
param linkedDomainResourceId string

param tags object = {}

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: communicationServiceName
  location: location
  tags: tags
  properties: {
    dataLocation: dataLocation
    linkedDomains: [
      linkedDomainResourceId
    ]
  }
}

output communicationServiceName string = communicationService.name
output communicationServiceId string = communicationService.id
