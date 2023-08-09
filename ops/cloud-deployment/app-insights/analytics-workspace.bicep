param location string = resourceGroup().location
param analyticsWorkspaceName string
param dailyQuotaGb int



resource analyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: analyticsWorkspaceName
  location: location
  properties: {
    sku: {
      name: 'pergb2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: dailyQuotaGb
    }
  }

}

output id string = analyticsWorkspace.id
