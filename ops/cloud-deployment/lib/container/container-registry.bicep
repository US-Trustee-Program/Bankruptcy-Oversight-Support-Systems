param name string
param location string = resourceGroup().location
param adminUserEnabled bool = false
param publicNetworkAccess string = 'Enabled'
param tags object = {}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: adminUserEnabled
    publicNetworkAccess: publicNetworkAccess
    zoneRedundancy: 'Disabled'
  }
  tags: tags
}

output registryId string = containerRegistry.id
output registryName string = containerRegistry.name
output loginServer string = containerRegistry.properties.loginServer
