/*
  Provision Private endpoint for Application Configuration Keyvault
*/
param location string = resourceGroup().location

@description('Name of App Configuration Keyvault')
param kvName string

@description('Id of App Configuration Keyvault')
param kvId string

@description('Virtual Network Name')
param virtualNetworkName string

@description('Subnet name the private endpoint should exist within')
param privateEndpointSubnetName string

@description('Subnet prefix for private endpoint')
param privateEndpointSubnetPrefix string

@description('Resource group the network subnet will reside')
param networkResourceGroup string

var keyvaultPrivateDnsZoneName = 'privatelink.vaultcore.usgovcloudapi.net'

module ustpPrivateDnsZone '../network/private-dns-zones.bicep' = {
  name: '${kvName}-private-dns-zone-module'
  scope: resourceGroup(networkResourceGroup)
  params: {
    stackName: kvName
    virtualNetworkName: virtualNetworkName
    privateDnsZoneName: keyvaultPrivateDnsZoneName
  }
}

module appConfigKeyvaultPrivateEndpoint '../network/subnet-private-endpoint.bicep' = {
  name: '${kvName}-kv-app-config-module'
  scope: resourceGroup(networkResourceGroup)
  params: {
    location: location
    privateDnsZoneName: ustpPrivateDnsZone.outputs.privateDnsZoneName
    privateEndpointSubnetAddressPrefix: privateEndpointSubnetPrefix
    privateEndpointSubnetName: privateEndpointSubnetName
    privateLinkServiceId: kvId
    stackName: kvName
    virtualNetworkName: virtualNetworkName
    privateLinkGroup: 'vault'
  }
}
