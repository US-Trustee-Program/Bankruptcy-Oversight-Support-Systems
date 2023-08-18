param location string = resourceGroup().location

param analyticsWorkspaceName string

param enableLinkedStorageAccount bool = true

module workspace './app-insights/analytics-workspace.bicep' = {
  name: '${analyticsWorkspaceName}-workspace-module'
  params: {
    location: location
    analyticsWorkspaceName: analyticsWorkspaceName
  }
}

resource analyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: analyticsWorkspaceName
}

module storage './storage/storage-account.bicep' = if (enableLinkedStorageAccount) {
  name: '${analyticsWorkspace.name}-storage-module'
  params: {
    location: location
    storageAccountName: toLower('stLogWS${uniqueString(subscription().subscriptionId, resourceGroup().id, analyticsWorkspace.name)}')
  }
}

resource alertsStorageLink 'Microsoft.OperationalInsights/workspaces/linkedStorageAccounts@2020-08-01' = if (enableLinkedStorageAccount) {
  parent: analyticsWorkspace
  name: 'Alerts'
  properties: {
    storageAccountIds: [
      storage.outputs.accountId
    ]
  }
}

resource logsStorageLink 'Microsoft.OperationalInsights/workspaces/linkedstorageaccounts@2020-08-01' = if (enableLinkedStorageAccount) {
  parent: analyticsWorkspace
  name: 'CustomLogs'
  properties: {
    storageAccountIds: [
      storage.outputs.accountId
    ]
  }
}

resource queryStorageLink 'Microsoft.OperationalInsights/workspaces/linkedstorageaccounts@2020-08-01' = if (enableLinkedStorageAccount) {
  parent: analyticsWorkspace
  name: 'Query'
  properties: {
    storageAccountIds: [
      storage.outputs.accountId
    ]
  }
}
