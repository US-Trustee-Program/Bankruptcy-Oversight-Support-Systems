param stackName string

param location string = resourceGroup().location

param appResourceGroup string = resourceGroup().name

@description('Flag: determines deployment of vnet. Determined at workflow runtime. True on initial deployment outside of USTP.')
param deployVnet bool = false

param vnetAddressPrefix array = [ '10.10.0.0/16' ]

param virtualNetworkName string = 'vnet-${stackName}'

param networkResourceGroupName string

@description('Array of Vnets to link to DNS Zone.')
param linkVnetIds array = []

@description('Flag: determines the setup of DNS Zone, Link virtual networks to zone.')
param deployDns bool = true

param privateDnsZoneName string = 'privatelink.azurewebsites.net'

param privateDnsZoneResourceGroup string = networkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

param privateEndpointSubnetName string = 'snet-${stackName}-private-endpoints'

param privateEndpointSubnetAddressPrefix string = '10.10.12.0/28'

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

param apiFunctionName string = '${stackName}-node-api'

param apiFunctionSubnetName string = 'snet-${apiFunctionName}'

param apiFunctionSubnetAddressPrefix string = '10.10.11.0/28'

param migrationFunctionName string = '${stackName}-migration'

param migrationSubnetAddressPrefix string = '10.10.13.0/28'

param migrationSubnetName string = 'snet-${migrationFunctionName}'

@description('Plan type to determine functionapp service plan Sku')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param functionPlanType string = 'P1v2'

param functionPlanName string = 'plan-${stackName}-functions'


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

@description('name of the app config KeyVault')
param kvAppConfigName string = 'kv-${stackName}'

@description('Flag: Determines creation and configuration of Alerts.')
param createAlerts bool = false

param actionGroupName string =''

@description('Flag: determines creation and configuration of Application Insights for the Azure Function.')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights.')
param analyticsWorkspaceId string = ''

param analyticsResourceGroupName string = 'rg-analytics'

@description('Url for our Okta Provider')
param oktaUrl string = ''

param loginProviderConfig string = ''

param loginProvider string = ''

param isUstpDeployment bool = false

param mssqlRequestTimeout string = '15000'

@description('Used to set Content-Security-Policy for USTP.')
@secure()
param ustpIssueCollectorHash string = ''

@description('Used to set Content-Security-Policy.')
@secure()
param camsReactSelectHash string

param cosmosDatabaseName string

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
    apiFunctionName: apiFunctionName
    apiFunctionSubnetName: apiFunctionSubnetName
    apiFunctionSubnetAddressPrefix: apiFunctionSubnetAddressPrefix
    migrationFunctionName: migrationFunctionName
    migrationSubnetAddressPrefix: migrationSubnetAddressPrefix
    migrationSubnetName: migrationSubnetName
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

module ustpWebapp 'frontend-webapp-deploy.bicep' = {
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
      targetApiServerHost: '${apiFunctionName}.azurewebsites${azHostSuffix} ${apiFunctionName}-${slotName}.azurewebsites${azHostSuffix}' //adding both production and slot hostname to CSP
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

module ustpFunctions 'backend-api-deploy.bicep' = {
    name: '${stackName}-function-module'
    scope: resourceGroup(appResourceGroup)
    params: {
      deployAppInsights: deployAppInsights
      analyticsWorkspaceId: analyticsWorkspaceId
      location: location
      planType: functionPlanType
      planName: functionPlanName
      apiFunctionName: apiFunctionName
      apiFunctionSubnetId: network.outputs.apiFunctionSubnetId
      migrationFunctionName: migrationFunctionName
      migrationFunctionSubnetId: network.outputs.migrationFunctionSubnetId
      functionsRuntime: 'node'
      sqlServerName: sqlServerName
      sqlServerResourceGroupName: sqlServerResourceGroupName
      sqlServerIdentityName: sqlServerIdentityName
      sqlServerIdentityResourceGroupName: sqlServerIdentityResourceGroupName
      apiCorsAllowOrigins: ['https://${webappName}.azurewebsites${azHostSuffix}']
      migrationCorsAllowOrigins: ['https://${webappName}.azurewebsites${azHostSuffix}','https://portal.azure.us']
      allowVeracodeScan: allowVeracodeScan
      idKeyvaultAppConfiguration: idKeyvaultAppConfiguration
      kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
      virtualNetworkResourceGroupName: networkResourceGroupName
      privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: analyticsResourceGroupName
      createAlerts: createAlerts
      privateDnsZoneName: privateDnsZoneName
      privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
      privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
      loginProviderConfig: loginProviderConfig
      loginProvider: loginProvider
      cosmosDatabaseName: cosmosDatabaseName
      kvAppConfigName: kvAppConfigName
      isUstpDeployment: isUstpDeployment
      mssqlRequestTimeout: mssqlRequestTimeout
    }
    dependsOn: [
      network
    ]
}
