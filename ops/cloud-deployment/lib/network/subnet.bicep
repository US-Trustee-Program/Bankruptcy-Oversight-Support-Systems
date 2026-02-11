param virtualNetworkName string

param subnetName string

param subnetAddressPrefix string

param subnetServiceEndpoints array = []

param subnetDelegations array = []

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2023-06-01' = {
  name: '${virtualNetworkName}/${subnetName}'
  properties: {
    addressPrefix: subnetAddressPrefix
    serviceEndpoints: subnetServiceEndpoints
    delegations: subnetDelegations
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

output subnetName string = subnet.name
output subnetId string = subnet.id
