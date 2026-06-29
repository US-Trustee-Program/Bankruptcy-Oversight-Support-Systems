@description('Name of the Azure Communication Services resource')
param communicationServiceName string

param location string = 'global'

@description('Data location for communication service (e.g., unitedstates)')
@allowed([
  'unitedstates'
])
param dataLocation string = 'unitedstates'

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

@secure()
output connectionString string = communicationService.listKeys().primaryConnectionString
output communicationServiceId string = communicationService.id
