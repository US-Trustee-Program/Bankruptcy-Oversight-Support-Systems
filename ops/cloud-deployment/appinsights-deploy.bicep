param location string = resourceGroup().location

param storageAccountName string

param analyticsWorkspaceName string 

param appInsightsName string

param applicationType string


module storageAccount './storage-deploy.bicep' = {
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
    capactiyReservationLimit: 0
    dailyQuotaGb: 0
  }
}
module appInsights './app-insights/app-insights.bicep' = {
  name: appInsightsName
  params: {
    location: location
    appInsightsName: appInsightsName   
    applicationType: applicationType
    workspaceResourceId: analyticsWorkspace.outputs.id
  }
}
