param appName string
param location string = resourceGroup().location
@description('Disable creating Azure virtual network by default.')
param deployVnet bool = false

@description('Deploy Azure Network resources: Private DNS Zone, and DNS Zone Vnet links')
param deployNetwork bool = true
param networkResourceGroupName string
param virtualNetworkName string = 'vnet-${appName}'
param linkVnetIds array = []
param vnetAddressPrefix array = [ '10.10.0.0/16' ]

param functionName string = '${appName}-node-api'
param functionSubnetName string = 'snet-${webappName}'
param functionsSubnetAddressPrefix string = '10.10.11.0/28'

param webappName string = '${appName}-node-api'
param webappSubnetName string = 'snet-${functionName}'
param webappSubnetAddressPrefix string = '10.10.10.0/28'

param privateEndpointSubnetName string = 'snet-${appName}-private-endpoints'
param privateEndpointSubnetAddressPrefix string = '10.10.12.0/28'

@description('Private DNS Zone Name')
param privateDnsZoneName string = 'privatelink.azurewebsites.net'
@description('Private DNS Zone Resource Group')
param privateDnsZoneResourceGroup string = networkResourceGroupName
@description('Private DNS Zone subscription, all 3 params here are set because the Prod environment uses a different subscription and RG for these')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId



module targetVnet './lib/network/vnet.bicep' =
  if (deployVnet) {
    name: '${appName}-vnet-module'
    scope: resourceGroup(networkResourceGroupName)
    params: {
      vnetName: virtualNetworkName
      vnetAddressPrefix: vnetAddressPrefix
      location: location
    }
  }

resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' existing = {
  name: virtualNetworkName
  scope: resourceGroup(networkResourceGroupName)
}

module ustpDnsZones './lib/network/private-dns-zones.bicep' ={
    name: '${appName}-network-module'
    scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
    params: {
      stackName: appName
      virtualNetworkId: ustpVirtualNetwork.id
      linkVnetIds: linkVnetIds
      privateDnsZoneName: privateDnsZoneName
      deployNetwork: deployNetwork
      privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
      privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
  }
}

/*
  Create subnet for private endpoint
*/
module privateEndpointSubnet './lib/network/subnet.bicep' = {
  name: '${privateEndpointSubnetName}-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    subnetAddressPrefix: privateEndpointSubnetAddressPrefix
    subnetName: privateEndpointSubnetName
    virtualNetworkName: virtualNetworkName
    subnetServiceEndpoints: [
      {
        service: 'Microsoft.Sql'
        locations: [
          location
        ]
      }
      {
        service: 'Microsoft.AzureCosmosDB'
        locations: [
          location
        ]
      }
    ]
  }
  dependsOn: [
    ustpVirtualNetwork
    ustpDnsZones
  ]
}

module functionSubnet './lib/network/subnet.bicep' = {
  name: '${functionName}-subnet-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    virtualNetworkName: virtualNetworkName
    subnetName: functionSubnetName
    subnetAddressPrefix: functionsSubnetAddressPrefix
    subnetServiceEndpoints: [
      {
        service: 'Microsoft.Sql'
        locations: [
          location
        ]
      }
      {
        service: 'Microsoft.AzureCosmosDB'
        locations: [
          location
        ]
      }
    ]
    subnetDelegations: [
      {
        name: 'Microsoft.Web/serverfarms'
        properties: {
          serviceName: 'Microsoft.Web/serverfarms'
        }
      }
    ]
  }
  dependsOn: [
    ustpVirtualNetwork
    ustpDnsZones
    privateEndpointSubnet
  ]
}

module webappSubnet './lib/network/subnet.bicep' = {
  name: '${webappName}-subnet-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    virtualNetworkName: virtualNetworkName
    subnetName: webappSubnetName
    subnetAddressPrefix: webappSubnetAddressPrefix
    subnetServiceEndpoints: []
    subnetDelegations: [
      {
        name: 'Microsoft.Web/serverfarms'
        properties: {
          serviceName: 'Microsoft.Web/serverfarms'
        }
      }
    ]
  }
  dependsOn: [
    ustpVirtualNetwork
    ustpDnsZones
    privateEndpointSubnet
  ]
}

output privateEndpointSubnetName string = privateEndpointSubnet.outputs.subnetName
output privateEndpointSubnetId string = privateEndpointSubnet.outputs.subnetId
output functionSubnetId string = functionSubnet.outputs.subnetId
output webappSubnetId string = webappSubnet.outputs.subnetId
output privateDnsZoneId string = ustpDnsZones.outputs.privateDnsZoneId
output cosmosDbAllowedSubnets array = [privateEndpointSubnet.outputs.subnetId, functionSubnet.outputs.subnetId]
