param location string = resourceGroup().location
@description('Existing resource group name for new CosmosDb instance')
param resourceGroupName string
@description('CosmosDb account name')
param accountName string
@description('CosmosDb database name')
param databaseName string
@description('List of container name and keys')
param databaseCollections array = [] // See parameters.json file

@description('Allowed network resource ids')
param allowedNetworks array = []

@description('The resource Id of the workspace.')
param analyticsWorkspaceId string = ''

@description('WARNING: Set CosmosDb account for public access for all. Should be only enable for development environment.')
param allowAllNetworks bool = false

param keyVaultName string

param kvResourceGroup string

@description('Action Group Name for alerts')
param actionGroupName string = 'EmailDevelopmentTeam'

@description('Action Group Resource Group Name for alerts')
param actionGroupResourceGroupName string = 'rg-analytics'

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = true

// CosmosDb for MongoDB
module account './lib/cosmos/mongo/cosmos-account.bicep' = {
  name: '${accountName}-cosmos-account-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    location: location
    allowedNetworks: allowedNetworks
    allowAllNetworks: allowAllNetworks
    keyVaultName: keyVaultName
    kvResourceGroup: kvResourceGroup
  }
}

//Need a way to get connection string from account into KV
module database './lib/cosmos/mongo/cosmos-database.bicep' = {
  name: '${accountName}-cosmos-database-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    databaseName: databaseName
  }
  dependsOn: [
    account
  ]
}

module collections './lib/cosmos/mongo/cosmos-collections.bicep' = {
  name: '${accountName}-cosmos-containers-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    databaseName: databaseName
    databaseCollections: databaseCollections
  }
  dependsOn: [
    database
  ]
}

module cosmosAvailabilityAlert './lib/monitoring-alerts/metrics-alert-rule.bicep' = if (createAlerts) {
  name: '${accountName}-availability-alert-module'
  params: {
    alertName: '${accountName}-availability-alert'
    appId: account.outputs.id
    timeAggregation: 'Average'
    operator: 'LessThan'
    targetResourceType: 'Microsoft.DocumentDB/databaseAccounts'
    metricName: 'ServiceAvailability'
    severity: 2
    threshold: 100
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
  }
}

module cosmosDiagnosticSetting './lib/app-insights/diagnostics-settings-cosmos.bicep' = if (!empty(analyticsWorkspaceId)) {
  name: '${accountName}-cosmos-diagnostic-setting-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    settingName: '${accountName}-diagnostic-setting'
    analyticsWorkspaceId: analyticsWorkspaceId
    accountName: accountName
  }
  dependsOn: [
    database
    collections
  ]
}
