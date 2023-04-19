@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('Target virtual network resource id to deploy private endpoint resources')
param webappPrivateEndpointVirtualNetworkId string

@description('Target subnet resource id')
param webappPrivateEndpointSubnetId string

@description('Web Application ID')
param webApplicationId string

@description('Private DNS Zone nam for private link')
param privateDNSZoneName string = 'privatelink.azurewebsites.net'

/*
  Resolves webapp DNS to a private IP via Private DNS Zone and Private Endpoint Link
*/
resource ustpPrivateDnsZone 'Microsoft.Network/privateDnsZones@2018-09-01' = {
  name: privateDNSZoneName
  location: 'global'
}

resource ustpPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2018-09-01' = {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: webappPrivateEndpointVirtualNetworkId
    }
  }
  name: '${privateDNSZoneName}-vnet-link'
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
      id: webappPrivateEndpointSubnetId
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
        name: 'privatelink_azurewebsites'
        properties: {
          privateDnsZoneId: ustpPrivateDnsZone.id
        }
      }
    ]
  }
}
