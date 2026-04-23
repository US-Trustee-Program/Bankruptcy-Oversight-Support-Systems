@description('Specifies the name of the key vault.')
param keyVaultName string

@description('Specifies the Azure location where the key vault should be created.')
param location string = resourceGroup().location

@description('Specifies whether the key vault is a standard vault or a premium vault.')
@allowed([
  'standard'
  'premium'
])
param skuName string = 'standard'

@description('Specifies whether Azure Virtual Machines are permitted to retrieve certificates stored as secrets from the key vault.')
param enabledForDeployment bool = false

@description('Specifies whether Azure Disk Encryption is permitted to retrieve secrets from the vault and unwrap keys.')
param enabledForDiskEncryption bool = false

@description('Specifies whether Azure Resource Manager is permitted to retrieve secrets from the key vault.')
param enabledForTemplateDeployment bool = false

@description('Specifies the Azure Active Directory tenant ID that should be used for authenticating requests to the key vault. Get it by using Get-AzSubscription cmdlet.')
param tenantId string = subscription().tenantId

param tags object = {}

// 'Disabled' was attempted and reverted (c7006f8ff) — private endpoint constraints block portal and pipeline access. RBAC (enableRbacAuthorization) is enforced as the primary access control.
@description('Controls whether the key vault is accessible from the public internet.')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Enabled'

param networkAcls object = {
  defaultAction: 'Allow'
  bypass: 'AzureServices'
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    enabledForDeployment: enabledForDeployment
    enabledForDiskEncryption: enabledForDiskEncryption
    enabledForTemplateDeployment: enabledForTemplateDeployment
    enableRbacAuthorization: true
    tenantId: tenantId

    sku: {
      name: skuName
      family: 'A'
    }
    publicNetworkAccess: publicNetworkAccess
    networkAcls: networkAcls
  }
}

output vaultId string = kv.id
output vaultName string = kv.name
output vaultUri string = kv.properties.vaultUri
