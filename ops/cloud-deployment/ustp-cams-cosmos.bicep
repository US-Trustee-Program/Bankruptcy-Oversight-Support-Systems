param location string = resourceGroup().location

param deployedAt string = utcNow()

@description('Existing resource group name for new CosmosDb instance')
param resourceGroupName string
@description('CosmosDb account name')
param accountName string
@description('CosmosDb database name')
param databaseName string

@description('Cosmos E2E database name')
param e2eDatabaseName string = ''

param deployE2eDatabase bool = false

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
param actionGroupResourceGroupName string

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = true

@description('List of allowed IP ranges on the USTP side')
param allowedIps array = []

var tags = {
  app: 'cams'
  component: 'cosmos'
  'deployed-at': deployedAt
}

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
    allowedIps: allowedIps
    tags: tags
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
  name: '${accountName}-cosmos-collections-module'
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

module e2eDatabase './ustp-cams-cosmos-e2e.bicep' = if(deployE2eDatabase && !empty(e2eDatabaseName)){
  name: '${accountName}-e2e-database-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    databaseName: e2eDatabaseName
    resourceGroupName: resourceGroupName
    databaseCollections: databaseCollections
  }
  dependsOn: [
    account
    collections
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
  dependsOn:[
    e2eDatabase
  ]
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
    e2eDatabase
  ]
}
