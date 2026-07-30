/*
  Description: Create Private Dns Zone associated to target vnet. Set linkVnetIds to include additional vnet links to dns.
*/
param privateDnsZoneResourceGroup string = resourceGroup().name

param privateDnsZoneSubscriptionId string = subscription().subscriptionId

param deployDns bool
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
resource ustpPrivateDnsZoneNew 'Microsoft.Network/privateDnsZones@2020-06-01' = if (deployDns) {
  name: privateDnsZoneName
  location: 'global'
}
resource ustpPrivateDnsZoneExisting 'Microsoft.Network/privateDnsZones@2020-06-01' existing = if (!deployDns) {
  name: privateDnsZoneName
}

// Linking this VNet to the zone must happen regardless of who owns the zone:
// deployDns=false means "an existing zone owned elsewhere, don't recreate it,"
// not "my VNet doesn't need to resolve names in it." Gating this on deployDns
// previously meant every caller that reused an existing zone (e.g. every
// branch reusing main's KV private DNS zone) never linked its own VNet to it,
// so DNS resolution for the private endpoint silently never worked.
module vnetLinks './vnet-links.bicep' = {
  name: 'vnet-links-module'
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
  params: {
    stackName: stackName
    virtualNetworkId: virtualNetworkId
    privateDnsZoneName: ((deployDns) ? ustpPrivateDnsZoneNew.name : ustpPrivateDnsZoneExisting.name)
    linkVnetIds: linkVnetIds
  }
}
output privateDnsZoneId string = ((deployDns) ? ustpPrivateDnsZoneNew.id : ustpPrivateDnsZoneExisting.id)
