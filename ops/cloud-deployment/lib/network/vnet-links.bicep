
param privateDnsZoneName string = 'privatelink.azurewebsites.us'
@description('Provide a name used for labeling related resources')
param stackName string
@description('Application\'s target virtual network resource id')
param virtualNetworkId string

@description('Optional array of resource ids of virtual network to link to private dns zone')
param linkVnetIds array = []

resource ustpPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = {
  name: privateDnsZoneName
}

resource ustpPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
  name: '${privateDnsZoneName}-vnet-link-${stackName}'
}

// optional step to include additional link to existing PrivateDnsZone
resource ustpAdditionalVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [
  for vnetId in linkVnetIds: {
    parent: ustpPrivateDnsZone
    location: 'global'
    properties: {
      registrationEnabled: false
      virtualNetwork: {
        id: vnetId
      }
    }
    name: 'vnet-link-${uniqueString(resourceGroup().id, vnetId)}'
  }
]

output privateDnsZoneName string = ustpPrivateDnsZone.name
