param appName string
param location string = resourceGroup().location

param deployVnet bool = false
param createVnet bool = false // NOTE: Set flag to false when vnet already exists
param vnetAddressPrefix array = [ '10.10.0.0/16' ]

param deployNetwork bool = true
param networkResourceGroupName string
param virtualNetworkName string = 'vnet-${appName}'
param linkVnetIds array = []

param deployWebapp bool = true
param webappName string = '${appName}-webapp'
param webappResourceGroupName string
param webappSubnetName string = 'snet-${webappName}'
param webappSubnetAddressPrefix string = '10.10.10.0/28'
param webappPrivateEndpointSubnetName string = 'snet-${webappName}-pep'
param webappPrivateEndpointSubnetAddressPrefix string = '10.10.11.0/28'
param webappPlanName string = 'plan-${webappName}'
@description('Plan type to determine webapp service plan Sku')
@allowed([
  'P1v2'
  'B2'
])
param webappPlanType string

param deployFunctions bool = true
param apiName string = '${appName}-node-api'
param apiFunctionsResourceGroupName string
param apiFunctionsSubnetName string = 'snet-${apiName}'
param apiFunctionsSubnetAddressPrefix string = '10.10.12.0/28'
param apiPrivateEndpointSubnetName string = 'snet-${apiName}-pep'
param apiPrivateEndpointSubnetAddressPrefix string = '10.10.13.0/28'
param apiPlanName string = 'plan-${apiName}'
@description('Plan type to determine functionapp service plan Sku')
@allowed([
  'P1v2'
  'B2'
])
param apiPlanType string

param privateDnsZoneName string = 'privatelink.azurewebsites.net'

@secure()
param databaseConnectionString string = ''
param sqlServerName string = ''
param sqlServerResourceGroupName string = ''

@description('Flag to enable Vercode access to execute DAST scanning')
param allowVeracodeScan bool = false

@description('Managed identity name with access to the key vault for PACER API credentials')
param pacerKeyVaultIdentityName string

@description('Resource group name managed identity with access to the key vault for PACER API credentials')
param pacerKeyVaultIdentityResourceGroupName string

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param createActionGroup bool = false

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

param analyticsResourceGroupName string = 'rg-analytics'

@description('Action Group Name for alerts')
param actionGroupName string
module actionGroup './monitoring-alerts/alert-action-group.bicep' = if(createActionGroup) {
  name: '${actionGroupName}-action-group-module'
  scope: resourceGroup(analyticsResourceGroupName)
  params: {
    actionGroupName: actionGroupName
  }
}
module targetVnet './vnet/virtual-network.bicep' = if (deployVnet && createVnet) {
  name: '${appName}-vnet-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    vnetName: virtualNetworkName
    vnetAddressPrefix: vnetAddressPrefix
    location: location
  }
}

module ustpNetwork './network-deploy.bicep' = if (deployNetwork) {
  name: '${appName}-network-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    stackName: appName
    virtualNetworkName: virtualNetworkName
    linkVnetIds: linkVnetIds
    privateDnsZoneName: privateDnsZoneName
  }
}

module ustpWebapp './frontend-webapp-deploy.bicep' = if (deployWebapp) {
  name: '${appName}-webapp-module'
  scope: resourceGroup(webappResourceGroupName)
  params: {
    deployAppInsights: deployAppInsights
    analyticsWorkspaceId: analyticsWorkspaceId
    planName: webappPlanName
    planType: webappPlanType
    webappName: webappName
    location: location
    privateDnsZoneName: ustpNetwork.outputs.privateDnsZoneName
    virtualNetworkName: ustpNetwork.outputs.virtualNetworkName
    virtualNetworkResourceGroupName: networkResourceGroupName
    webappSubnetName: webappSubnetName
    webappSubnetAddressPrefix: webappSubnetAddressPrefix
    webappPrivateEndpointSubnetName: webappPrivateEndpointSubnetName
    webappPrivateEndpointSubnetAddressPrefix: webappPrivateEndpointSubnetAddressPrefix
    allowVeracodeScan: allowVeracodeScan
    createAlerts: createAlerts
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: analyticsResourceGroupName
  }
}

var funcParams = [
  {// Define api node function resources
    planName: apiPlanName
    planType: apiPlanType
    functionName: apiName
    functionsRuntime: 'node'
    functionSubnetName: apiFunctionsSubnetName
    functionsSubnetAddressPrefix: apiFunctionsSubnetAddressPrefix
    privateEndpointSubnetName: apiPrivateEndpointSubnetName
    privateEndpointSubnetAddressPrefix: apiPrivateEndpointSubnetAddressPrefix
  }
]
module ustpFunctions './backend-api-deploy.bicep' = [for (config, i) in funcParams: if (deployFunctions) {
  name: '${appName}-function-module-${i}'
  scope: resourceGroup(apiFunctionsResourceGroupName)
  params: {
    deployAppInsights: deployAppInsights
    analyticsWorkspaceId: analyticsWorkspaceId
    location: location
    planName: funcParams[i].planName
    functionName: funcParams[i].functionName
    functionsRuntime: funcParams[i].functionsRuntime
    virtualNetworkName: virtualNetworkName
    virtualNetworkResourceGroupName: networkResourceGroupName
    functionSubnetName: funcParams[i].functionSubnetName
    functionsSubnetAddressPrefix: funcParams[i].functionsSubnetAddressPrefix
    privateEndpointSubnetName: funcParams[i].privateEndpointSubnetName
    privateEndpointSubnetAddressPrefix: funcParams[i].privateEndpointSubnetAddressPrefix
    privateDnsZoneName: ustpNetwork.outputs.privateDnsZoneName
    databaseConnectionString: databaseConnectionString
    sqlServerName: sqlServerName
    sqlServerResourceGroupName: sqlServerResourceGroupName
    corsAllowOrigins: [ 'https://${ustpWebapp.outputs.webappUrl}' ]
    allowVeracodeScan: allowVeracodeScan
    pacerKeyVaultIdentityName: pacerKeyVaultIdentityName
    pacerKeyVaultIdentityResourceGroupName: pacerKeyVaultIdentityResourceGroupName
    createAlerts: createAlerts
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: analyticsResourceGroupName
  }
  dependsOn: [
    ustpWebapp
  ]
}]

output webappName string = ustpWebapp.outputs.webappName
output functionAppName string = deployFunctions ? ustpFunctions[0].outputs.functionAppName : ''
output vnetName string = virtualNetworkName

// Allowed subnet name that should have access to CosmosDb
// Leverage az-cosmos-add-vnet-rule.sh to add vnet rule
output cosmosDbAllowedSubnet string = apiFunctionsSubnetName
