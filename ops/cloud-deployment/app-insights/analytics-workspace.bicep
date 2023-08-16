param location string = resourceGroup().location
param analyticsWorkspaceName string
param dailyQuotaGb int = -1

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

module storage '../storage/storage-account.bicep' = {
  name: '${analyticsWorkspace.name}-stg-module'
  params: {
    location: location
    storageAccountName: 'stg-analytics-workspace'
  }
}

output id string = analyticsWorkspace.id
