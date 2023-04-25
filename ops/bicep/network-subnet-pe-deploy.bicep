param location string = resourceGroup().location
param prefixName string
param virtualNetworkName string
param privateDnsZoneName string
param privateEndpointSubnetName string
param privateEndpointSubnetAddressPrefix string
@description('Resource id of existing service to be linked')
param privateLinkServiceId string

/*
  Create subnet for private endpoint
*/
resource virtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' existing = {
  name: virtualNetworkName
}
resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
  parent: virtualNetwork
  name: privateEndpointSubnetName
  properties: {
    addressPrefix: privateEndpointSubnetAddressPrefix
    serviceEndpoints: []
    delegations: []
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

/*
  Create private endpoint
*/
var privateEndpointName = '${prefixName}-pe'
var privateEndpointConnectionName = '${prefixName}-pe-connection'
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2022-09-01' = {
  name: privateEndpointName
  location: location
  properties: {
    privateLinkServiceConnections: [
      {
        name: privateEndpointConnectionName
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
      id: privateEndpointSubnet.id
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
