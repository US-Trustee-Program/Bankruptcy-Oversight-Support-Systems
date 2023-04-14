@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('Application\'s target virtual network name')
param virtualNetworkName string = '${appName}-vnet'

@description('Webapp private endpoint subnet ip ranges')
param webappPrivateEndpointSubnetAddressPrefix string = '10.0.5.0/28'

@description('Web Application ID')
param webApplicationId string

@description('Webapp private endpoint name')
param webappPrivateEndpointSubnetName string = '${virtualNetworkName}-webapp-pe'

resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' existing = {
  name: virtualNetworkName
}

resource webappPrivateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
  name: webappPrivateEndpointSubnetName
  parent: ustpVirtualNetwork
  properties: {
    addressPrefix: webappPrivateEndpointSubnetAddressPrefix
    serviceEndpoints: []
    delegations: []
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

/*
  Resolves webapp DNS to a private IP via Private DNS Zone and Private Endpoint Link
*/
resource ustpPrivateDnsZone 'Microsoft.Network/privateDnsZones@2018-09-01' = {
  name: 'privatelink.azurewebsites.net'
  location: 'global'
}

resource ustpPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2018-09-01' = {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: ustpVirtualNetwork.id
    }
  }
  name: 'privatelink.azurewebsites.net-vnet-link'
}

var webappPrivateEndpointName = '${appName}-webapp-private-endpoint'
var webappPrivateEndpointConnectionName = '${appName}-webapp-private-endpoint-connection'
resource ustpWebappPrivateEndpoint 'Microsoft.Network/privateEndpoints@2022-09-01' = {
  name: webappPrivateEndpointName
  location: location
  properties: {
    privateLinkServiceConnections: [
      {
        name: webappPrivateEndpointConnectionName
        properties: {
          privateLinkServiceId: webApplicationId
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
      id: webappPrivateEndpointSubnet.id
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
}

resource ustpPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2022-09-01' = {
  parent: ustpWebappPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink_azurewebsites_net'
        properties: {
          privateDnsZoneId: ustpPrivateDnsZone.id
        }
      }
    ]
  }
}

output outWebappPrivateEndpointSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, webappPrivateEndpointSubnetName)
