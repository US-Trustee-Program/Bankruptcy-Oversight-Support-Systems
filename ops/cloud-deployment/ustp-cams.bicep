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
@description('Plan type to determine plan Sku')
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
@description('Plan type to determine plan Sku')
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

module targetVnet './vnet-deploy.bicep' = if (deployVnet && createVnet) {
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
  }
  dependsOn: [
    ustpWebapp
  ]
}]

output webappName string = ustpWebapp.outputs.webappName
output functionAppName string = deployFunctions ? ustpFunctions[0].outputs.functionAppName : ''
