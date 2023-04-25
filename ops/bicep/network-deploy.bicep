@description('Sets an application name')
param appName string

@description('Application\'s target virtual network name')
param virtualNetworkName string

@description('Private DNS Zone name for private link')
param privateDNSZoneName string = 'privatelink.azurewebsites.net'

@description('Optional array of resource ids of virtual network to link to private dns zone')
param linkVnetIds array = []

/*
  USTP BOSS Virtual Network
*/
resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' existing = {
  name: virtualNetworkName
}

/*
  Private DNS Zone and linked virtual networks
*/
resource ustpPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: privateDNSZoneName
  location: 'global'
  tags: {
    appName: appName
  }
}

resource ustpPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: ustpVirtualNetwork.id
    }
  }
  name: '${privateDNSZoneName}-vnet-link'
}

// optional step to include additional link to existing PrivateDnsZone
resource ustpAdditionalVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [for vnetId in linkVnetIds: {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
  name: 'ustp-${uniqueString(resourceGroup().id, vnetId)}-vnet-link'
}]

output virtualNetworkId string = ustpVirtualNetwork.id
output virtualNetworkName string = ustpVirtualNetwork.name
output privateDnsZoneName string = ustpPrivateDnsZone.name
