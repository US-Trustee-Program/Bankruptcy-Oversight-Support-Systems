/*
  Description: Create Private Dns Zone associated to target vnet. Set linkVnetIds to include additional vnet links to dns.
*/
param privateDnsZoneResourceGroup string = resourceGroup().name
param privateDnsZoneSubscriptionId string = subscription().subscriptionId
param deployNetwork bool
@description('Provide a name used for labeling related resources')
param stackName string

@description('Application\'s target virtual network resource id')
param virtualNetworkId string

@description('Private DNS Zone name for private link')
param privateDnsZoneName string = 'privatelink.azurewebsites.us'

@description('Optional array of resource ids of virtual network to link to private dns zone')
param linkVnetIds array = []

/*
  Private DNS Zone and linked virtual networks
*/
resource ustpPrivateDnsZoneNew 'Microsoft.Network/privateDnsZones@2020-06-01' = if (deployNetwork) {
  name: privateDnsZoneName
  location: 'global'
}
resource ustpPrivateDnsZoneExisting 'Microsoft.Network/privateDnsZones@2020-06-01' existing = if (deployNetwork) {
  name: privateDnsZoneName
}

module vnetLinks './vnet-links.bicep' = {
  name: 'vnet-links-module'
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
  params: {
    stackName: stackName
    virtualNetworkId: virtualNetworkId
    privateDnsZoneName: ((deployNetwork) ? ustpPrivateDnsZoneNew.name : ustpPrivateDnsZoneExisting.name)
    linkVnetIds: linkVnetIds
  }
}
output privateDnsZoneId string = ((deployNetwork) ? ustpPrivateDnsZoneNew.id : ustpPrivateDnsZoneExisting.id)
