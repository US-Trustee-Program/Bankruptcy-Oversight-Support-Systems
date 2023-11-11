/*
  Provision Azure Keyvault and Managed identity with role Secrets User for the
  purpose of storing application configurations.
*/

param appName string
param location string = resourceGroup().location
param kvResourceGroup string

var managedIdentityName = 'id-kv-app-config-user'

module appConfigIdentity 'identity/managed-identity.bicep' = {
  name: '${appName}-id-app-config-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    location: location
    managedIdentityName: managedIdentityName
  }
}

module appConfigKeyvault 'keyvault/keyvault.bicep' = {
  name: '${appName}-kv-app-config-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    location: location
    keyVaultName: 'kv-${appName}'
    objectId: appConfigIdentity.outputs.principalId
    roleName: 'Key Vault Secrets User'
  }
}

output appConfigIdentityId string = appConfigIdentity.outputs.id
output appConfigIdentityClientId string = appConfigIdentity.outputs.clientId
output appConfigIdentityPrincipalId string = appConfigIdentity.outputs.principalId
