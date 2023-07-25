param location string = resourceGroup().location
param analyticsName string
param capactiyReservationLimit int
param dailyQuotaGb int



resource symbolicname 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: analyticsName
  location: location
  properties: {
    defaultDataCollectionRuleResourceId: 'string'
    features: {
      disableLocalAuth: false
      enableDataExport: true
      enableLogAccessUsingOnlyResourcePermissions: true
      immediatePurgeDataOn30Days: false
    }
    forceCmkForQuery: false
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    retentionInDays: 180
    sku: {
      capacityReservationLevel: capactiyReservationLimit
      name: 'pergb2018'
    }
    workspaceCapping: {
      dailyQuotaGb: dailyQuotaGb
    }
  }
}
