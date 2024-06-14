param stackName string

param location string = resourceGroup().location

param appResourceGroup string = resourceGroup().name

@description('Flag: determines deployment of vnet. Determined at workflow runtime. True on initial deployment outside of USTP.')
param deployVnet bool = false

param vnetAddressPrefix array = [ '10.10.0.0/16' ]

@description('Flag: determines the setup of DNS Zone, Link virtual networks to zone.')
param deployDns bool = true

param networkResourceGroupName string

param virtualNetworkName string = 'vnet-${stackName}'

@description('Array of Vnets to link to DNS Zone.')
param linkVnetIds array = []

param privateEndpointSubnetName string = 'snet-${stackName}-private-endpoints'

param privateEndpointSubnetAddressPrefix string = '10.10.12.0/28'

@description('Flag: Deploy Bicep config for webapp. False on slot deployments.')
param deployWebapp bool = true

param webappName string = '${stackName}-webapp'

param webappSubnetName string = 'snet-${webappName}'

param webappSubnetAddressPrefix string = '10.10.10.0/28'

@description('Plan type to determine webapp service plan Sku.')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param webappPlanType string = 'P1v2'

@description('Flag: Deploy Bicep config for Azure function. False on slot deployments.')
param deployFunctions bool = true

param functionName string = '${stackName}-node-api'

param functionSubnetName string = 'snet-${functionName}'

param functionSubnetAddressPrefix string = '10.10.11.0/28'

@description('Plan type to determine functionapp service plan Sku')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param functionPlanType string = 'P1v2'


param privateDnsZoneName string = 'privatelink.azurewebsites.net'

param privateDnsZoneResourceGroup string = networkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

@description('Name of deployment slot for frontend and backend')
param slotName string = 'staging'

param azHostSuffix string = '.us'

param sqlServerName string = ''

param sqlServerResourceGroupName string = ''

@description('Name for managed identity of database server.')
param sqlServerIdentityName string = ''

param sqlServerIdentityResourceGroupName string = ''

@description('Flag: Enable Vercode access to execute DAST scanning')
param allowVeracodeScan bool = false

@description('Name of the managed identity with read access to the keyvault storing application configurations. ')
@secure()
param idKeyvaultAppConfiguration string

param kvAppConfigResourceGroupName string = sqlServerResourceGroupName

@description('Flag: Determines creation and configuration of Alerts.')
param createAlerts bool = false

param actionGroupName string =''

@description('Flag: determines creation and configuration of Application Insights for the Azure Function.')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights.')
param analyticsWorkspaceId string = ''

param analyticsResourceGroupName string = 'rg-analytics'

@description('Url for our Okta Provider')
param oktaUrl string = 'https://dev-31938913.okta.com'

@description('Used to set Content-Security-Policy for USTP.')
@secure()
param ustpIssueCollectorHash string = ''

@description('Used to set Content-Security-Policy.')
@secure()
param camsReactSelectHash string

@description('Name of the managed identity with read/write access to CosmosDB.')
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

module network './lib//network/ustp-cams-network.bicep' = {
  name: '${stackName}-network-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    stackName: stackName
    networkResourceGroupName: networkResourceGroupName
    deployVnet: deployVnet
    location: location
    functionName: functionName
    functionSubnetName: functionSubnetName
    functionSubnetAddressPrefix: functionSubnetAddressPrefix
    webappName: webappName
    webappSubnetAddressPrefix: webappSubnetAddressPrefix
    webappSubnetName: webappSubnetName
    deployDns: deployDns
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
    name: '${stackName}-webapp-module'
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
      privateDnsZoneName: privateDnsZoneName
      privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
      privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
      oktaUrl: oktaUrl
    }
    dependsOn: [
      network
    ]
  }

module ustpFunctions 'backend-api-deploy.bicep' =
if (deployFunctions) {
    name: '${stackName}-function-module'
    scope: resourceGroup(appResourceGroup)
    params: {
      deployAppInsights: deployAppInsights
      analyticsWorkspaceId: analyticsWorkspaceId
      location: location
      planType: functionPlanType
      planName: 'plan-${functionName}'
      functionName: functionName
      functionsRuntime: 'node'
      functionSubnetId: network.outputs.functionSubnetId
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
      privateDnsZoneName: privateDnsZoneName
      privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
      privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    }
    dependsOn: [
      network
    ]
  }

// main.bicep outputs

output vnetName string = virtualNetworkName

resource identityKeyVaultAppConfig 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: idKeyvaultAppConfiguration
  scope: resourceGroup(kvAppConfigResourceGroupName)
}
output keyVaultId string = identityKeyVaultAppConfig.id
output keyVaultManagedIdName string = identityKeyVaultAppConfig.name
