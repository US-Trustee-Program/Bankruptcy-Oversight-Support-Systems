param appName string
param location string = resourceGroup().location

@description('Disable creating Azure virtual network by default.')
param deployVnet bool = false
@description('Create Azure virtual network. Set flag to false when vnet already exists.')
param createVnet bool = false
param vnetAddressPrefix array = [ '10.10.0.0/16' ]

@description('Setup Azure resources for Private DNS Zone. Link virtual networks to zone.')
param deployNetwork bool = true
param networkResourceGroupName string
param virtualNetworkName string = 'vnet-${appName}'
param linkVnetIds array = []

@description('Set to true to deploy web module resources. This should be set to false for Azure slot deployments.')
param deployWebapp bool = true
param webappName string = '${appName}-webapp'
param webappResourceGroupName string
param webappSubnetName string = 'snet-${webappName}'
param webappSubnetAddressPrefix string = '10.10.10.0/28'
param webappPrivateEndpointSubnetName string = 'snet-${appName}-pep'
param webappPrivateEndpointSubnetAddressPrefix string = '10.10.11.0/28'
param webappPlanName string = 'plan-${webappName}'
@description('Plan type to determine webapp service plan Sku')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param webappPlanType string

@description('Set to true to deploy api module resources. This should be set to false for Azure slot deployments.')
param deployFunctions bool = true
param apiName string = '${appName}-node-api'
param apiFunctionsResourceGroupName string
param apiFunctionsSubnetName string = 'snet-${apiName}'
param apiFunctionsSubnetAddressPrefix string = '10.10.12.0/28'
param apiPrivateEndpointSubnetName string = 'snet-${appName}-pep'
param apiPrivateEndpointSubnetAddressPrefix string = '10.10.11.0/28'
param apiPlanName string = 'plan-${apiName}'
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
param azHostSuffix string = '.net'

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

@description('boolean to determine creation of Action Groups')
param createActionGroup bool = false

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

@description('Resource Group name for analytics and monitoring')
param analyticsResourceGroupName string

@description('Resource group name of the app config KeyVault')
param kvAppConfigResourceGroupName string

@description('Action Group Name for alerts')
param actionGroupName string

@description('Optional. USTP Issue Collector hash. Used to set Content-Security-Policy')
@secure()
param ustpIssueCollectorHash string = ''

@description('React-Select hash. Used to set Content-Security-Policy')
@secure()
param camsReactSelectHash string

@description('Name of the managed identity with read access to the keyvault storing application configurations.')
@secure()
param idKeyvaultAppConfiguration string

//TODO: break out ActionGroup and Alerts into their own bicep
module actionGroup './lib/monitoring-alerts/alert-action-group.bicep' =
  if (createActionGroup) {
    name: '${actionGroupName}-action-group-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      actionGroupName: actionGroupName
    }
  }
module targetVnet './lib/network/vnet.bicep' =
  if (deployVnet && createVnet) {
    name: '${appName}-vnet-module'
    scope: resourceGroup(networkResourceGroupName)
    params: {
      vnetName: virtualNetworkName
      vnetAddressPrefix: vnetAddressPrefix
      location: location
    }
  }

resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' existing = {
  name: virtualNetworkName
  scope: resourceGroup(networkResourceGroupName)
}

module ustpNetwork './lib/network/private-dns-zones.bicep' =
  if (deployNetwork) {
    name: '${appName}-network-module'
    scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
    params: {
      stackName: appName
      virtualNetworkId: ustpVirtualNetwork.id
      linkVnetIds: linkVnetIds
      privateDnsZoneName: privateDnsZoneName
    }
  }

module ustpWebapp 'frontend-webapp-deploy.bicep' =
  if (deployWebapp) {
    name: '${appName}-webapp-module'
    scope: resourceGroup(webappResourceGroupName)
    params: {
      deployAppInsights: deployAppInsights
      analyticsWorkspaceId: analyticsWorkspaceId
      planName: webappPlanName
      planType: webappPlanType
      webappName: webappName
      location: location
      privateDnsZoneName: privateDnsZoneName
      privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
      privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
      virtualNetworkName: virtualNetworkName
      virtualNetworkResourceGroupName: networkResourceGroupName
      webappSubnetName: webappSubnetName
      webappSubnetAddressPrefix: webappSubnetAddressPrefix
      webappPrivateEndpointSubnetName: webappPrivateEndpointSubnetName
      webappPrivateEndpointSubnetAddressPrefix: webappPrivateEndpointSubnetAddressPrefix
      allowVeracodeScan: allowVeracodeScan
      createAlerts: createAlerts
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: analyticsResourceGroupName
      targetApiServerHost: '${apiName}.azurewebsites${azHostSuffix} ${apiName}-${slotName}.azurewebsites${azHostSuffix}' //adding both production and slot hostname to CSP
      ustpIssueCollectorHash: ustpIssueCollectorHash
      camsReactSelectHash: camsReactSelectHash
    }
  }

var funcParams = [
  {
    // Define api node function resources
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
module ustpFunctions 'backend-api-deploy.bicep' = [
  for (config, i) in funcParams: if (deployFunctions && deployWebapp) {
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
      privateDnsZoneName: privateDnsZoneName
      privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
      privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
      databaseConnectionString: databaseConnectionString
      sqlServerName: sqlServerName
      sqlServerResourceGroupName: sqlServerResourceGroupName
      sqlServerIdentityName: sqlServerIdentityName
      sqlServerIdentityResourceGroupName: sqlServerIdentityResourceGroupName
      corsAllowOrigins: ['https://${webappName}.azurewebsites${azHostSuffix}']
      allowVeracodeScan: allowVeracodeScan
      createAlerts: createAlerts
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: analyticsResourceGroupName
      idKeyvaultAppConfiguration: idKeyvaultAppConfiguration
      kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
    }
  }
]

// main.bicep outputs

output vnetName string = virtualNetworkName
output webappSubnetName string = webappSubnetName
output webappPrivateEndpointSubnetName string = webappPrivateEndpointSubnetName
output apiPrivateEndpointSubnetName string = apiPrivateEndpointSubnetName

// Allowed subnet name that should have access to CosmosDb
// Leverage az-cosmos-add-vnet-rule.sh to add vnet rule
output cosmosDbAllowedSubnet string = apiFunctionsSubnetName

resource identityKeyVaultAppConfig 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: idKeyvaultAppConfiguration
  scope: resourceGroup(kvAppConfigResourceGroupName)
}
output keyVaultId string = identityKeyVaultAppConfig.id
output keyVaultManagedIdName string = identityKeyVaultAppConfig.name
