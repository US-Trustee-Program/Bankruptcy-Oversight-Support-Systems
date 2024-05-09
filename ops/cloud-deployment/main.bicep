param appName string
param location string = resourceGroup().location
param appResourceGroup string = resourceGroup().name
@description('Disable creating Azure virtual network by default.')
param deployVnet bool = false
param vnetAddressPrefix array = [ '10.10.0.0/16' ]

@description('Setup Azure resources for Private DNS Zone. Link virtual networks to zone.')
param deployNetwork bool = true
param networkResourceGroupName string
param virtualNetworkName string = 'vnet-${appName}'
param linkVnetIds array = []

@description('Set to true to deploy web module resources. This should be set to false for Azure slot deployments.')
param deployWebapp bool = true
param webappName string = '${appName}-webapp'
param webappPrivateEndpointSubnetName string = 'snet-${appName}-pep'
param webappSubnetName string = 'snet-${webappName}'
param webappSubnetAddressPrefix string = '10.10.10.0/28'

param privateEndpointSubnetName string = 'subnet-private-endpoints'
param privateEndpointSubnetAddressPrefix string = '10.10.12.0/28'
@description('Plan type to determine webapp service plan Sku')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param webappPlanType string

@description('Set to true to deploy api module resources. This should be set to false for Azure slot deployments.')
param deployFunctions bool = true
param functionName string = '${appName}-node-api'
param functionSubnetName string = 'snet-${functionName}'
param functionSubnetAddressPrefix string = '10.10.11.0/28'
param functionPrivateEndpointSubnetName string = 'snet-${appName}-pep'
@description('Plan type to determine functionapp service plan Sku')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param apiPlanType string

param privateDnsZoneName string = 'privatelink.azurewebsites.net'
param privateDnsZoneResourceGroup string = resourceGroup().name
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

@description('Name of deployment slot for frontend and backend')
param slotName string = 'staging'
param azHostSuffix string = '.us'

@secure()
param databaseConnectionString string = ''
param sqlServerName string = ''
param sqlServerResourceGroupName string = ''
@description('Name for managed identity of database server')
param sqlServerIdentityName string = ''
@description('Resource group name for managed identity of database server')
param sqlServerIdentityResourceGroupName string = ''

@description('Flag to enable Vercode access to execute DAST scanning')
param allowVeracodeScan bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''
@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

@description('Resource Group name for analytics and monitoring')
param analyticsResourceGroupName string

@description('Resource group name of the app config KeyVault')
param kvAppConfigResourceGroupName string

@description('Action Group Name for alerts')
param actionGroupName string =''

@description('Optional. USTP Issue Collector hash. Used to set Content-Security-Policy')
@secure()
param ustpIssueCollectorHash string = ''

@description('React-Select hash. Used to set Content-Security-Policy')
@secure()
param camsReactSelectHash string

@description('Name of the managed identity with read access to the keyvault storing application configurations.')
@secure()
param idKeyvaultAppConfiguration string

@description('Name of the managed identity with read/write access to CosmosDB')
@secure()
param cosmosIdentityName string

module actionGroup './lib/monitoring-alerts/alert-action-group.bicep' =
  if (createAlerts) {
    name: '${actionGroupName}-action-group-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      actionGroupName: actionGroupName
    }
  }
module network './ustp-cams-network.bicep' = {
  name: '${appName}-network-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    appName: appName
    networkResourceGroupName: networkResourceGroupName
    deployVnet: deployVnet
    location: location
    functionName: functionName
    functionSubnetName: functionSubnetName
    functionsSubnetAddressPrefix: functionSubnetAddressPrefix
    webappName: webappName
    webappSubnetAddressPrefix: webappSubnetAddressPrefix
    webappSubnetName: webappSubnetName
    deployNetwork: deployNetwork
    privateDnsZoneName: privateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    privateEndpointSubnetAddressPrefix: privateEndpointSubnetAddressPrefix
    privateEndpointSubnetName: privateEndpointSubnetName
    linkVnetIds: linkVnetIds
    vnetAddressPrefix: vnetAddressPrefix
    virtualNetworkName: virtualNetworkName
  }
}
module ustpWebapp 'frontend-webapp-deploy.bicep' =
  if (deployWebapp) {
    name: '${appName}-webapp-module'
    scope: resourceGroup(appResourceGroup)
    params: {
      deployAppInsights: deployAppInsights
      analyticsWorkspaceId: analyticsWorkspaceId
      planName: 'plan-${webappName}'
      planType: webappPlanType
      webappName: webappName
      location: location
      virtualNetworkResourceGroupName: networkResourceGroupName
      allowVeracodeScan: allowVeracodeScan
      createAlerts: createAlerts
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: analyticsResourceGroupName
      targetApiServerHost: '${functionName}.azurewebsites${azHostSuffix} ${functionName}-${slotName}.azurewebsites${azHostSuffix}' //adding both production and slot hostname to CSP
      ustpIssueCollectorHash: ustpIssueCollectorHash
      camsReactSelectHash: camsReactSelectHash
      webappSubnetId: network.outputs.webappSubnetId
      privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
      appServiceRuntime: 'php'
      deployNetwork: deployNetwork
    }
    dependsOn: [
      network
    ]
  }

// var funcParams = [
//   {
//     // Define api node function resources
//     planName: '${functionName}-plan'
//     planType: apiPlanType
//     functionName: functionName
//     functionsRuntime: 'node'
//     functionSubnetName: functionSubnetName
//     functionsSubnetAddressPrefix: functionSubnetAddressPrefix
//     privateEndpointSubnetName:
//     privateEndpointSubnetAddressPrefix: privateEndpointSubnetAddressPrefix
//   }
// ]
// module ustpFunctions 'backend-api-deploy.bicep' = [
//   for (config, i) in funcParams: if (deployFunctions && deployWebapp) {
//     name: '${appName}-function-module-${i}'
//     scope: resourceGroup(appResourceGroup)
//     params: {
//       deployAppInsights: deployAppInsights
//       analyticsWorkspaceId: analyticsWorkspaceId
//       location: location
//       planName: funcParams[i].planName
//       functionName: funcParams[i].functionName
//       functionsRuntime: funcParams[i].functionsRuntime
//       functionSubnetId: funcParams[i].functionSubnetName
//       databaseConnectionString: databaseConnectionString
//       sqlServerName: sqlServerName
//       sqlServerResourceGroupName: sqlServerResourceGroupName
//       sqlServerIdentityName: sqlServerIdentityName
//       sqlServerIdentityResourceGroupName: sqlServerIdentityResourceGroupName
//       corsAllowOrigins: ['https://${webappName}.azurewebsites${azHostSuffix}']
//       allowVeracodeScan: allowVeracodeScan
//       idKeyvaultAppConfiguration: idKeyvaultAppConfiguration
//       cosmosIdentityName: cosmosIdentityName
//       kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
//       virtualNetworkResourceGroupName: networkResourceGroupName
//       privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
//       actionGroupName: actionGroupName
//       actionGroupResourceGroupName: analyticsResourceGroupName
//       createAlerts: createAlerts
//     }
//   }
// ]
module ustpFunctions 'backend-api-deploy.bicep' = if (deployFunctions) {
    name: '${appName}-function-module'
    scope: resourceGroup(appResourceGroup)
    params: {
      deployAppInsights: deployAppInsights
      analyticsWorkspaceId: analyticsWorkspaceId
      location: location
      planType: apiPlanType
      planName: '${functionName}-plan'
      functionName: functionName
      functionsRuntime: 'node'
      functionSubnetId: network.outputs.functionSubnetId
      databaseConnectionString: databaseConnectionString
      sqlServerName: sqlServerName
      sqlServerResourceGroupName: sqlServerResourceGroupName
      sqlServerIdentityName: sqlServerIdentityName
      sqlServerIdentityResourceGroupName: sqlServerIdentityResourceGroupName
      corsAllowOrigins: ['https://${webappName}.azurewebsites${azHostSuffix}']
      allowVeracodeScan: allowVeracodeScan
      idKeyvaultAppConfiguration: idKeyvaultAppConfiguration
      cosmosIdentityName: cosmosIdentityName
      kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
      virtualNetworkResourceGroupName: networkResourceGroupName
      privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: analyticsResourceGroupName
      createAlerts: createAlerts
      deployNetwork: deployNetwork
    }
    dependsOn: [
      network
    ]
  }

// main.bicep outputs

output vnetName string = virtualNetworkName
output webappPrivateEndpointSubnetName string = webappPrivateEndpointSubnetName
output apiPrivateEndpointSubnetName string = functionPrivateEndpointSubnetName

// Allowed subnet name that should have access to CosmosDb
// Leverage az-cosmos-add-vnet-rule.sh to add vnet rule

resource identityKeyVaultAppConfig 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: idKeyvaultAppConfiguration
  scope: resourceGroup(kvAppConfigResourceGroupName)
}
output keyVaultId string = identityKeyVaultAppConfig.id
output keyVaultManagedIdName string = identityKeyVaultAppConfig.name
