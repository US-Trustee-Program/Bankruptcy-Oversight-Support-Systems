/*
  Provision Azure Keyvault and Managed identity with role Secrets User for the
  purpose of storing application configurations.
*/
@description('Application name will be use to name keyvault')
param stackName string

param location string = resourceGroup().location

@description('Target resource group to provision App Configuration Keyvault')
param kvResourceGroup string

@description('Managed identity with Secrets User role to Keyvault')
param managedIdentityName string = 'id-kv-app-config-${uniqueString(stackName)}'

@description('Application Configuration network access control settings')
param kvNetworkAcls object = {
  defaultAction: 'Deny'
  bypass: 'AzureServices'
  ipRules: []
  virtualNetworkRules: []
}

module appConfigIdentity '../identity/managed-identity.bicep' = {
  name: '${stackName}-id-app-config-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    location: location
    managedIdentityName: managedIdentityName
  }
}

module appConfigKeyvault '../keyvault/keyvault.bicep' = {
  name: '${stackName}-kv-app-config-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    location: location
    keyVaultName: 'kv-${stackName}'
    objectId: appConfigIdentity.outputs.principalId
    roleName: 'Key Vault Secrets User'
    networkAcls: kvNetworkAcls
  }
  dependsOn: [
    appConfigIdentity
  ]
}

output appConfigIdentityName string = appConfigIdentity.outputs.name
output appConfigIdentityId string = appConfigIdentity.outputs.id
output appConfigIdentityClientId string = appConfigIdentity.outputs.clientId
output appConfigIdentityPrincipalId string = appConfigIdentity.outputs.principalId
output appConfigVaultName string = appConfigKeyvault.outputs.vaultName
output appConfigVaultId string = appConfigKeyvault.outputs.vaultId
