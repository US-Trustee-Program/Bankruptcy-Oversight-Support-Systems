// Applies a CanNotDelete resource lock to an existing Key Vault. Deployed as
// its own module because the lock is an extension resource that must be
// created at the scope of the resource group the vault actually lives in,
// which may differ from the scope of the template deploying it.
targetScope = 'resourceGroup'

param keyVaultName string

param lockName string

param lockNotes string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource keyVaultLock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: lockName
  scope: keyVault
  properties: {
    level: 'CanNotDelete'
    notes: lockNotes
  }
}
