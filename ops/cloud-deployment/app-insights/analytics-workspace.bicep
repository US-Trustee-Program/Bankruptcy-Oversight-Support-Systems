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

// module storage '../storage/storage-account.bicep' = {
//   name: '${analyticsWorkspace.name}-storage-module'
//   params: {
//     location: location
//     storageAccountName: 'stganalyticsworkspace'
//   }
// }
// resource alertsStorageLink 'Microsoft.OperationalInsights/workspaces/linkedstorageaccounts@2020-08-01' = {
//   parent: analyticsWorkspace
//   name: 'Alerts'
//   location: location
//   properties: {
//     storageAccountIds: [
//       storage.outputs.accountId
//     ]
//   }
// }

// resource logsStorageLink 'Microsoft.OperationalInsights/workspaces/linkedstorageaccounts@2020-08-01' = {
//   parent: analyticsWorkspace
//   name: 'CustomLogs'
//   location: location
//   properties: {
//     storageAccountIds: [
//       storage.outputs.accountId
//     ]
//   }
// }

// resource queryStorageLink 'Microsoft.OperationalInsights/workspaces/linkedstorageaccounts@2020-08-01' = {
//   parent: analyticsWorkspace
//   name: 'Query'
//   location: location
//   properties: {
//     storageAccountIds: [
//       storage.outputs.accountId
//     ]
//   }
// }

output id string = analyticsWorkspace.id
