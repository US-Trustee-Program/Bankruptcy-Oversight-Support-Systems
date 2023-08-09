param location string = resourceGroup().location

param storageAccountName string

param analyticsWorkspaceName string


module storageAccount './storage/storage-account.bicep' = {
  name: storageAccountName
  params: {
    location: location
    storageAccountName: storageAccountName
  }
}
module analyticsWorkspace './app-insights/analytics-workspace.bicep' = {
  name: analyticsWorkspaceName
  params: {
    location: location
    analyticsWorkspaceName: analyticsWorkspaceName
    dailyQuotaGb: 1
  }
}
