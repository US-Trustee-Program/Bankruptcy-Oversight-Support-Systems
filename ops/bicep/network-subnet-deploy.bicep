param virtualNetworkName string
param subnetName string
param subnetAddressPrefix string
param subnetServiceEndpoints array = []
param subnetDelegations array = []

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' existing = {
  name: virtualNetworkName
}

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
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

output subnetId string = subnet.id
