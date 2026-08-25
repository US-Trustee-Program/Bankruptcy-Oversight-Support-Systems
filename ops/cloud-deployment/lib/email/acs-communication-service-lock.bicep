// Applies a CanNotDelete resource lock to an existing Communication Service.
// Deployed as its own module because the lock is an extension resource that
// must be created at the scope of the resource group the resource actually
// lives in, which may differ from the scope of the template deploying it.
targetScope = 'resourceGroup'

param communicationServiceName string

param lockName string

param lockNotes string

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' existing = {
  name: communicationServiceName
}

resource communicationServiceLock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: lockName
  scope: communicationService
  properties: {
    level: 'CanNotDelete'
    notes: lockNotes
  }
}
