@description('Provide a name used for labeling related resources')
param stackName string

param location string = resourceGroup().location

param virtualNetworkName string
param privateEndpointSubnetName string
param privateEndpointSubnetAddressPrefix string
param privateDnsZoneName string
@description('Resource id of existing service to be linked')
param privateLinkServiceId string

/*
  Create subnet for private endpoint
*/
module privateEndpointSubnet './network-subnet-deploy.bicep' = {
  name: '${privateEndpointSubnetName}-module'
  params: {
    subnetAddressPrefix: privateEndpointSubnetAddressPrefix
    subnetName: privateEndpointSubnetName
    virtualNetworkName: virtualNetworkName
  }
}

/*
  Create private endpoint
*/
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2022-09-01' = {
  name: 'pep-${stackName}'
  location: location
  properties: {
    privateLinkServiceConnections: [
      {
        name: 'pep-connection-${stackName}'
        properties: {
          privateLinkServiceId: privateLinkServiceId
          groupIds: [
            'sites'
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
      id: privateEndpointSubnet.outputs.subnetId
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
}

/*
  Add private dns zone group to private endpoint
*/
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = {
  name: privateDnsZoneName
}
resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2022-09-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink_azurewebsites'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
}

output privateEndpointSubnetName string = privateEndpointSubnet.outputs.subnetName
output privateEndpointSubnetId string = privateEndpointSubnet.outputs.subnetId
