@description('Stack Name that helps give many resources unique names. Flexion and USTP Required')
param appName string
param location string = resourceGroup().location
param appResourceGroup string = resourceGroup().name
@description('Boolean to deploy vnet. Determined at workflow runtime. Flexion and USTP required on initial deployment')
param deployVnet bool = false
@description('Prefic to Vnet address. USTP Required')
param vnetAddressPrefix array = [ '10.10.0.0/16' ]

@description('Setup Network Resources: DNS Zone, Subnets, Link virtual networks to zone. Flexion and USTP required')
param deployNetwork bool = true
@description('Network RG Name. Flexion and USTP Required')
param networkResourceGroupName string
@description(' Vnet Name. USTP Required')
param virtualNetworkName string = 'vnet-${appName}'
@description('Array of Vnets to link to DNS Zone. USTP Required')
param linkVnetIds array = []

@description('Private Endpoint Subnet Name. USTP Required')
param privateEndpointSubnetName string = 'snet-${appName}-private-endpoints'
@description('Private Endpoint Subnet address prefix. USTP Required')
param privateEndpointSubnetAddressPrefix string = '10.10.12.0/28'

@description('Flag: Deploy Bicep config for webapp. False on slot deployments . Flexion and USTP Required')
param deployWebapp bool = true
param webappName string = '${appName}-webapp'
@description('Webapp PE Subnet Name. Exists in PE Subnet')
param webappPrivateEndpointSubnetName string = privateEndpointSubnetName
@description('Webapp Subnet Name. USTP Required')
param webappSubnetName string = 'snet-${webappName}'
@description('Webapp Subnet address prefix. USTP Required')
param webappSubnetAddressPrefix string = '10.10.10.0/28'
@description('Plan type to determine webapp service plan Sku. Flexion and USTP Required')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param webappPlanType string

@description('Flag: Deploy Bicep config for Azure function. False on slot deployments . Flexion and USTP Required')
param deployFunctions bool = true
param functionName string = '${appName}-node-api'
@description('Function Subet Name. USTP Required')
param functionSubnetName string = 'snet-${functionName}'
@description('Function Subnet Address Prefix. USTP Required')
param functionSubnetAddressPrefix string = '10.10.11.0/28'
@description('Webapp PE Subnet Name. Exists in PE Subnet')
param functionPrivateEndpointSubnetName string = privateEndpointSubnetName
@description('Plan type to determine functionapp service plan Sku')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param apiPlanType string


param privateDnsZoneName string = 'privatelink.azurewebsites.net'
param privateDnsZoneResourceGroup string = networkResourceGroupName
@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment. USTP Required')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

@description('Name of deployment slot for frontend and backend')
param slotName string = 'staging'
param azHostSuffix string = '.us'

@description('SQL Connection for USTP Environment. Flexion uses Managed ID. USTP Required')
@secure()
param databaseConnectionString string = ''
@description('SQL Server Name. Flexion and USTP Required')
param sqlServerName string = ''
@description('SQL RG Name. Flexion and USTP Required')
param sqlServerResourceGroupName string = ''
@description('Name for managed identity of database server. Flexion Required')
param sqlServerIdentityName string = ''
@description('Resource group name for managed identity of database server. Flexion Required')
param sqlServerIdentityResourceGroupName string = ''

@description('Flag to enable Vercode access to execute DAST scanning')
param allowVeracodeScan bool = false

@description('Log Analytics Workspace ID associated with Application Insights. Flexion and USTP Required')
param analyticsWorkspaceId string = ''
@description('boolean to determine creation and configuration of Application Insights for the Azure Function. USTP Required')
param deployAppInsights bool = false

@description('boolean to determine creation and configuration of Alerts. Flexion Required')
param createAlerts bool = false

@description('Resource Group name for analytics and monitoring. USTP Required')
param analyticsResourceGroupName string = 'rg-analytics'

@description('Resource group name of the app config KeyVault. USTP Required')
param kvAppConfigResourceGroupName string = sqlServerResourceGroupName

@description('Action Group Name for alerts. Flexion Required')
param actionGroupName string =''

@description('Optional. USTP Issue Collector hash. Used to set Content-Security-Policy. USTP Required')
@secure()
param ustpIssueCollectorHash string = ''

@description('React-Select hash. Used to set Content-Security-Policy. Flexion and USTP Required')
@secure()
param camsReactSelectHash string

@description('Name of the managed identity with read access to the keyvault storing application configurations. Flexion and USTP Required')
@secure()
param idKeyvaultAppConfiguration string

@description('Name of the managed identity with read/write access to CosmosDB. Flexion and USTP Required')
@secure()
param cosmosIdentityName string

//TODO: Break out Alerts && Action Group
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
