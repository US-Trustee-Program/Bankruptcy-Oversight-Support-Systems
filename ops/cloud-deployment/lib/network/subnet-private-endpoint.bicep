@description('Provide a name used for labeling related resources')
param stackName string

param location string = resourceGroup().location
@description('Resource id of existing service to be linked')
param privateLinkServiceId string
@description('Group for private link service')
@allowed([
  'sites'
  'vault'
])
param privateLinkGroup string
param privateEndpointSubnetId string


resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-02-01' = {
  name: 'pep-${stackName}'
  location: location
  properties: {
    privateLinkServiceConnections: [
      {
        name: 'pep-connection-${stackName}'
        properties: {
          privateLinkServiceId: privateLinkServiceId
          groupIds: [
            privateLinkGroup
          ]
          privateLinkServiceConnectionState: {
            status: 'Approved'
            actionsRequired: 'None'
          }
        }
      }
    ]
    manualPrivateLinkServiceConnections: []
    subnet: {
      id: privateEndpointSubnetId
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
}
