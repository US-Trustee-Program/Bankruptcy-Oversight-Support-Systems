param location string = resourceGroup().location

@description('Azure weapp name')
param webappName string

@description('Azure weapp deployment slot name')
param webappSlotName string = 'staging'

@description('Existing Private DNS Zone used for application')
param privateDnsZoneName string

@description('Existing virtual network name')
param virtualNetworkName string = 'vnet-ustp-cams-dev'

@description('Resource group name of target virtual network')
param virtualNetworkResourceGroupName string

@description('Backend private endpoint subnet name')
param privateEndpointSubnetName string

@description('Backend private endpoint subnet ip ranges')
param privateEndpointSubnetAddressPrefix string

resource webapp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: webappName
}
resource webappSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-02-01' existing = {
  name: privateEndpointSubnetName
}
resource webappSlot 'Microsoft.Web/sites/slots@2022-09-01' = {
  parent: webapp
  name: webappSlotName
  location: location
  properties: {
    cloningInfo: {
      sourceWebAppId: webapp.id
      sourceWebAppLocation: location
    }
    virtualNetworkSubnetId: webappSubnet.id
  }
}
resource webappSlotConfig 'Microsoft.Web/sites/slots/config@2023-01-01'= {
  parent: webappSlot
  name: 'web'
  properties: {
    linuxFxVersion: 'PHP|8.2'
    ipSecurityRestrictions: [
      {
        ipAddress: '0.0.0.0/0'
        action: 'Allow'
        tag: 'Default'
        priority: 100
        name: 'AllowAll'
      }
      {
        ipAddress: 'Any'
        action: 'Deny'
        priority: 2147483647
        name: 'Deny all'
        description: 'Deny all access'
      }
    ]
    ipSecurityRestrictionsDefaultAction: 'Deny'
    scmIpSecurityRestrictions: [
      {
        ipAddress: 'Any'
        action: 'Allow'
        priority: 2147483647
        name: 'Allow all'
        description: 'Allow all access'
      }
    ]
    scmIpSecurityRestrictionsDefaultAction: 'Deny'
  }

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
