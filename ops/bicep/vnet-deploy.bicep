@description('Sets an application name')
param appName string

param location string = resourceGroup().location

param createVnet bool = false

param vnetName string = '${appName}-vnet'

param vnetAddressPrefix array

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' = if (createVnet) {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: vnetAddressPrefix
    }
    enableDdosProtection: false
  }
}

output vnetId string = virtualNetwork.id
output vnetName string = virtualNetwork.name
