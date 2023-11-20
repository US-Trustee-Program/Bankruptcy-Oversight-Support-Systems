/*
  Description: Create Private Dns Zone associated to target vnet. Set linkVnetIds to include additional vnet links to dns.
*/

@description('Provide a name used for labeling related resources')
param stackName string

@description('Application\'s target virtual network name')
param virtualNetworkName string

@description('Private DNS Zone name for private link')
param privateDnsZoneName string = 'privatelink.azurewebsites.net'

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
  name: privateDnsZoneName
  location: 'global'
  tags: {
    appName: stackName
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
  name: '${privateDnsZoneName}-vnet-link'
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
  name: 'vnet-link-${uniqueString(resourceGroup().id, vnetId)}'
}]

output virtualNetworkName string = ustpVirtualNetwork.name
output privateDnsZoneName string = ustpPrivateDnsZone.name
