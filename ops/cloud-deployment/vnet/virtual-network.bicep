param location string = resourceGroup().location

param vnetName string

param vnetAddressPrefix array

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2023-02-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: vnetAddressPrefix
    }
    enableDdosProtection: false
  }
}

output vnetName string = virtualNetwork.name
