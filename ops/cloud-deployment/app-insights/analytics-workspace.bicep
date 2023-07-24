param location string = resourceGroup().location
param analyticsName string
param capactiyReservationLimit int
param dailyQuotaGb int



resource symbolicname 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: analyticsName
  location: location
  identity: {
    type: 'string'
    userAssignedIdentities: {}
  }
  properties: {
    defaultDataCollectionRuleResourceId: 'string'
    features: {
      clusterResourceId: 'string'
      disableLocalAuth: false
      enableDataExport: true
      enableLogAccessUsingOnlyResourcePermissions: true
      immediatePurgeDataOn30Days: false
    }
    forceCmkForQuery: false
    publicNetworkAccessForIngestion: 'string'
    publicNetworkAccessForQuery: 'string'
    retentionInDays: 180
    sku: {
      capacityReservationLevel: capactiyReservationLimit
      name: 'string'
    }
    workspaceCapping: {
      dailyQuotaGb: dailyQuotaGb
    }
  }
}
