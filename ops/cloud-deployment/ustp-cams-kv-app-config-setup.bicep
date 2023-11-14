@description('Application name will be use to name keyvault prepended by kv-')
param stackName string

param location string = resourceGroup().location

@description('Target resource group to provision App Configuration Keyvault')
param kvResourceGroup string

@description('Name of App Configuration Keyvault')
param kvName string

@description('Virtual Network Name')
param virtualNetworkName string

@description('Subnet name the private endpoint should exist within')
param privateEndpointSubnetName string

@description('Subnet prefix for private endpoint')
param privateEndpointSubnetPrefix string

@description('Resource group the network subnet will reside')
param networkResourceGroup string

module kvAppConfig './keyvault-app-config-setup/kv-app-config.bicep' = {
  name: '${stackName}-kv-app-config-module'
  params: {
    location: location
    kvResourceGroup: kvResourceGroup
    stackName: stackName
  }
}

module kvNetworkConfig './keyvault-app-config-setup/kv-app-config-network.bicep' = {
  name: '${stackName}-kv-network-config-module'
  params: {
    location: location
    kvName: kvName
    kvId: kvAppConfig.outputs.appConfigVaultId
    networkResourceGroup: networkResourceGroup
    privateEndpointSubnetName: privateEndpointSubnetName
    privateEndpointSubnetPrefix: privateEndpointSubnetPrefix
    virtualNetworkName: virtualNetworkName
  }
}
