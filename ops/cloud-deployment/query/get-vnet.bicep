param virtualNetworkName string

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2023-02-01' existing = {
  name: virtualNetworkName
}

output subnets array = virtualNetwork.properties.subnets
