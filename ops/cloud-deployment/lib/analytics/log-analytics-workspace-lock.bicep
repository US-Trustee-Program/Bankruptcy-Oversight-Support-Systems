// Applies a CanNotDelete resource lock to an existing Log Analytics workspace.
// Deployed as its own module because the lock is an extension resource that
// must be created at the scope of the resource group the workspace actually
// lives in, which may differ from the scope of the template deploying it.
targetScope = 'resourceGroup'

param workspaceName string

param lockName string

param lockNotes string

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: workspaceName
}

resource workspaceLock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: lockName
  scope: workspace
  properties: {
    level: 'CanNotDelete'
    notes: lockNotes
  }
}
