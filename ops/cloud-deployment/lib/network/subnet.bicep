param virtualNetworkName string
param subnetName string
param subnetAddressPrefix string
param subnetServiceEndpoints array = []
param subnetDelegations array = []

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2023-02-01' existing = {
  name: virtualNetworkName
}

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2023-02-01' = {
  parent: virtualNetwork
  name: subnetName
  properties: {
    addressPrefix: subnetAddressPrefix
    serviceEndpoints: subnetServiceEndpoints
    delegations: subnetDelegations
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

output vnetName string = virtualNetwork.name
output vnetId string = virtualNetwork.id
output subnetName string = subnet.name
output subnetId string = subnet.id
