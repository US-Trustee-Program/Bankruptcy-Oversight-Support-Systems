param location string = resourceGroup().location

@description('Azure weapp name')
param webappName string

@description('Azure weapp deployment slot name')
param webappSlotName string = 'staging'

@description('Backend private endpoint subnet name')
param privateEndpointSubnetName string = 'snet-ustp-cams-dev-5e91e7-webapp'

@description('Resource group name of target virtual network')
param virtualNetworkResourceGroupName string
// @description('Existing Private DNS Zone used for application')
// param privateDnsZoneName string
// @description('Existing virtual network name')
// param virtualNetworkName string = 'vnet-ustp-cams-dev'
// @description('Backend private endpoint subnet ip ranges')
// param privateEndpointSubnetAddressPrefix string

resource webapp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: webappName
}
resource webappSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-02-01' existing = {
  name: privateEndpointSubnetName
  scope: resourceGroup(virtualNetworkResourceGroupName)
}
resource webappSlot 'Microsoft.Web/sites/slots@2022-09-01' existing = {
  parent: webapp
  name: webappSlotName
}
module privateEndpoint '../network/private-endpoint.bicep' = {
  name: 'pep-${webappName}-${webappSlotName}-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params:{
    location: location
    serviceId: webappSlot.id
    stackName: '${webappName}-${webappSlotName}'
    subnetId: webappSubnet.id
  }

}
