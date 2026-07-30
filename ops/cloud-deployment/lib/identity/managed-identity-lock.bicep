// Applies a CanNotDelete resource lock to an existing managed identity.
// Deployed as its own module because the lock is an extension resource that
// must be created at the scope of the resource group the identity actually
// lives in, which may differ from the scope of the template deploying it.
targetScope = 'resourceGroup'

param managedIdentityName string

param lockName string

param lockNotes string

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: managedIdentityName
}

resource managedIdentityLock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: lockName
  scope: managedIdentity
  properties: {
    level: 'CanNotDelete'
    notes: lockNotes
  }
}
