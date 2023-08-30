param location string = resourceGroup().location
@description('Existing resource group name for new CosmosDb instance')
param resourceGroupName string
@description('CosmosDb account name')
param accountName string
@description('CosmosDb database name')
param databaseName string
@description('List of container name and keys')
param databaseContainers array = [
  {
    name: 'healthcheck'
    partitionKey1: '/id'
  }
]

@description('Allowed subnet resource id')
param allowedSubnet string = ''

@description('The resource Id of the workspace.')
param analyticsWorkspaceId string = ''

@description('Action Group ID for alerts')
param actionGroupId string = ''
// CosmosDb
module account './cosmos/cosmos-account.bicep' = {
  name: '${accountName}-cosmos-account-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    location: location
    allowedSubnets: [ allowedSubnet ]
  }
}

module database './cosmos/cosmos-database.bicep' = {
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

module containers './cosmos/cosmos-containers.bicep' = {
  name: '${accountName}-cosmos-containers-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    accountName: accountName
    databaseName: databaseName
    databaseContainers: databaseContainers
  }
  dependsOn: [
    database
  ]
}

// Role definition for read and write access
module customReadWriteRole './cosmos/cosmos-custom-role.bicep' = {
  name: '${accountName}-cosmos-roles-module'
  params: {
    accountName: accountName
  }
  dependsOn: [
    account
  ]
}

// Identity to access CosmosDb
module cosmosDbUserManagedIdentity './identity/managed-identity.bicep' = {
  name: '${accountName}-cosmos-user-id-module'
  params: {
    location: location
    managedIdentityName: 'id-${accountName}-user'
  }
  dependsOn: [
    account
  ]
}

// Assign permissions (role) to Identity
module cosmosDbRoleAssignment './cosmos/cosmos-role-assignment.bicep' = {
  name: '${accountName}-cosmos-role-assignment-module'
  params: {
    accountName: accountName
    principalId: cosmosDbUserManagedIdentity.outputs.principalId
    roleDefinitionId: customReadWriteRole.outputs.roleDefinitionId
  }
  dependsOn: [
    account
    customReadWriteRole
    cosmosDbUserManagedIdentity
  ]
}

module cosmosAvailabilityAlert './monitoring-alerts/metrics-alert-rule.bicep' = {
  name: '${accountName}-availability-alert-module'
  params: {
    alertName: '${accountName}-availability-alert'
    appId: account.outputs.id
    actionGroupId: actionGroupId
    timeAggregation: 'Average'
    operator: 'LessThan'
    targetResourceType: 'Microsoft.DocumentDB/databaseAccounts'
    metricName: 'ServiceAvailability'
    severity: 2
    threshold: 100
  }
}
module cosmosDiagnosticSetting './app-insights/diagnostics-settings-cosmos.bicep' = if (!empty(analyticsWorkspaceId)){
  name: '${accountName}-cosmos-diagnostic-setting-module'
  scope: resourceGroup(resourceGroupName)
  params: {
    settingName: '${accountName}-diagnostic-setting'
    analyticsWorkspaceId: analyticsWorkspaceId
    accountName: accountName
  }
  dependsOn: [
    database
    containers
  ]
}

output cosmosDbClientId string = cosmosDbUserManagedIdentity.outputs.clientId
output cosmosDbPrincipalId string = cosmosDbUserManagedIdentity.outputs.principalId
