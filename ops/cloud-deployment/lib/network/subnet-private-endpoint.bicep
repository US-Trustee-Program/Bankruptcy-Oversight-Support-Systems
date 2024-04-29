@description('Provide a name used for labeling related resources')
param stackName string

param location string = resourceGroup().location

param virtualNetworkName string
param privateEndpointSubnetName string
param privateEndpointSubnetAddressPrefix string
param privateDnsZoneName string
param privateDnsZoneResourceGroup string = resourceGroup().name
param privateDnsZoneSubscriptionId string = subscription().subscriptionId
param privatDnsZoneId string = ''
@description('Resource id of existing service to be linked')
param privateLinkServiceId string
@description('Group for private link service')
@allowed([
  'sites'
  'vault'
])
param privateLinkGroup string

/*
  Create subnet for private endpoint
*/
module privateEndpointSubnet 'subnet.bicep' = {
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
      id: privateEndpointSubnet.outputs.subnetId
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
}

/*
  Add private dns zone group to private endpoint
*/
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = if (empty(privatDnsZoneId)) {
  name: privateDnsZoneName
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
}

var dnsZoneId = empty(privateDnsZone.id) ? privateDnsZone.id : privatDnsZoneId
resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-02-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink_azurewebsites_${stackName}'
        properties: {
          privateDnsZoneId: dnsZoneId
        }
      }
    ]
  }
}

output privateEndpointSubnetName string = privateEndpointSubnet.outputs.subnetName
output privateEndpointSubnetId string = privateEndpointSubnet.outputs.subnetId
