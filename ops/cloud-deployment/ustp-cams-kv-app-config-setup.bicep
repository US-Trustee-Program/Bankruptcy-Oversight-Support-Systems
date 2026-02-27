/*
  Example to execute deployment template:
  az deployment group create -w \
    -g bankruptcy-oversight-support-systems
    --template-file ops/cloud-deployment/ustp-cams-kv-app-config-setup.bicep \
    --parameters stackName=cams-test \
                 virtualNetworkName=vnet-test \
                 kvResourceGroup=bankruptcy-oversight-support-systems \
                 networkResourceGroup=bankruptcy-oversight-support-systems \
                 privateEndpointSubnetName=snet-pep-kv-test \
                 privateEndpointSubnetPrefix=10.20.20.0/28

  What needs to happen
  1. Provision managed identity.
  2. Provision keyvault and update keyvault access to allow managed identity with "Key Vault Secrets User" to secrets.
  3. Deploy private DNS zone (privatelink.vaultcore.usgovcloudapi.net) and ensure virtual network of the service using keyvault is linked.
  4. Setup private endpoint resources in target subnet. Subnet should be in same virtual network as service using keyvault.
*/

@description('Application name will be use to name keyvault prepended by kv-')
param stackName string

param deployedAt string = utcNow()

param deployDns bool = true

param location string = resourceGroup().location

@description('Target resource group to provision App Configuration Keyvault')
param kvResourceGroup string

@description('Name of App Configuration Keyvault')
param kvName string = 'kv-${stackName}'

@description('Resource group the network subnet will reside')
param networkResourceGroup string

@description('Virtual network to create subnet for private endpoint resource')
param virtualNetworkName string

@description('Subnet ID of the private endpoint should exist within')
param privateEndpointSubnetId string

@description('Resource group of target Private DNS Zone')
param privateDnsZoneResourceGroup string = resourceGroup().name

@description('Subscription of target Private DNS Zone. Defaults to subscription of current deployment')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

var keyvaultPrivateDnsZoneName = 'privatelink.vaultcore.usgovcloudapi.net'

@description('Application Configuration network access control settings')
param kvNetworkAcls object = {
  defaultAction: 'Deny'
  bypass: 'AzureServices'
  ipRules: []
  virtualNetworkRules: []
}

@description('Managed identity with Secrets User role to Keyvault')
param managedIdentityName string = 'id-kv-app-config-${uniqueString(stackName)}'

var tags = {
  app: 'cams'
  component: 'security'
  'deployed-at': deployedAt
}

module appConfigIdentity './lib/identity/managed-identity.bicep' = {
  name: '${stackName}-id-app-config-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    location: location
    managedIdentityName: managedIdentityName
    tags: tags
  }
}

module appConfigKeyvault './lib/keyvault/keyvault.bicep' = {
  name: '${stackName}-kv-app-config-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    location: location
    keyVaultName: kvName
    objectId: appConfigIdentity.outputs.principalId
    roleName: 'Key Vault Secrets User'
    networkAcls: kvNetworkAcls
    tags: tags
  }
}

resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-11-01' existing = {
  name: virtualNetworkName
  scope: resourceGroup(networkResourceGroup)
}

module ustpPrivateDnsZone './lib/network/private-dns-zones.bicep' = {
  name: '${kvName}-private-dns-zone-module'
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
  params: {
    stackName: kvName
    virtualNetworkId: ustpVirtualNetwork.id
    privateDnsZoneName: keyvaultPrivateDnsZoneName
    deployDns: deployDns
  }
}

module appConfigKeyvaultPrivateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${kvName}-kv-app-config-module'
  scope: resourceGroup(networkResourceGroup)
  params: {
    location: location
    privateLinkServiceId: appConfigKeyvault.outputs.vaultId
    stackName: kvName
    privateEndpointSubnetId: privateEndpointSubnetId
    privateLinkGroup: 'vault'
    privateDnsZoneName: keyvaultPrivateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    tags: tags
  }
}
