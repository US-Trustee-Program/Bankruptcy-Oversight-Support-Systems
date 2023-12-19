param location string = resourceGroup().location

@description('Azure weapp name')
param webappName string

@description('Azure weapp deployment slot name')
param webappSlotName string = 'staging'

@description('Existing Private DNS Zone used for application')
param privateDnsZoneName string

@description('Existing virtual network name')
param virtualNetworkName string

@description('Resource group name of target virtual network')
param virtualNetworkResourceGroupName string

@description('Backend private endpoint subnet name')
param privateEndpointSubnetName string

@description('Backend private endpoint subnet ip ranges')
param privateEndpointSubnetAddressPrefix string

resource webapp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: webappName
}
resource webappSlot 'Microsoft.Web/sites/slots@2022-09-01' existing = {
  parent: webapp
  name: webappSlotName
}

module slotPrivateEndpoint '../network/subnet-private-endpoint.bicep' = {
  name: '${webappName}-${webappSlotName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites'
    stackName: '${webappName}-${webappSlotName}'
    location: location
    virtualNetworkName: virtualNetworkName
    privateDnsZoneName: privateDnsZoneName
    privateEndpointSubnetName: privateEndpointSubnetName
    privateEndpointSubnetAddressPrefix: privateEndpointSubnetAddressPrefix
    privateLinkServiceId: webappSlot.id
  }
}
