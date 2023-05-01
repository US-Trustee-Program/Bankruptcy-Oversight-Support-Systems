param appName string
param location string = resourceGroup().location

param deployVnet bool = false
param createVnet bool = false
param vnetAddressPrefix array = [ '10.0.0.0/16' ]

param deployNetwork bool = true
param networkResourceGroupName string
param virtualNetworkName string = '${appName}-vnet'
param linkVnetIds array = []

param deployWebapp bool = true
param webappResourceGroupName string
param webappSubnetName string = '${virtualNetworkName}-webapp'
param webappSubnetAddressPrefix string = '10.0.2.0/28'
param webappPrivateEndpointSubnetName string = '${virtualNetworkName}-webapp-pe'
param webappPrivateEndpointSubnetAddressPrefix string = '10.0.3.0/28'

param deployFunctions bool = true
param apiFunctionsResourceGroupName string = 'ustp-app-rg'
param apiFunctionsSubnetName string = '${appName}-vnet-function-node'
param apiFunctionsSubnetAddressPrefix string = '10.0.10.0/28'
param apiPrivateEndpointSubnetName string = '${appName}-function-node-pe'
param apiPrivateEndpointSubnetAddressPrefix string = '10.0.11.0/28'
param apiPlanName string = '${appName}-node-functions-asp'

param privateDnsZoneName string = 'privatelink.azurewebsites.net'

@secure()
param databaseConnectionString string = ''
param sqlServerName string = ''
param sqlServerResourceGroupName string = ''

module targetVnet './vnet-deploy.bicep' = if (deployVnet && createVnet) {
  name: '${appName}-vnet-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    appName: appName
    vnetName: virtualNetworkName
    vnetAddressPrefix: vnetAddressPrefix
    location: location
  }
}

module ustpNetwork './network-deploy.bicep' = if (deployNetwork) {
  name: '${appName}-network-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    appName: appName
    virtualNetworkName: virtualNetworkName
    linkVnetIds: linkVnetIds
  }
}

module ustpWebapp './webapp-deploy.bicep' = if (deployWebapp) {
  name: '${appName}-webapp-module'
  scope: resourceGroup(webappResourceGroupName)
  params: {
    appName: appName
    location: location
    privateDnsZoneName: ustpNetwork.outputs.privateDnsZoneName
    virtualNetworkName: ustpNetwork.outputs.virtualNetworkName
    virtualNetworkResourceGroupName: networkResourceGroupName
    webappSubnetName: webappSubnetName
    webappSubnetAddressPrefix: webappSubnetAddressPrefix
    webappPrivateEndpointSubnetName: webappPrivateEndpointSubnetName
    webappPrivateEndpointSubnetAddressPrefix: webappPrivateEndpointSubnetAddressPrefix
  }
}

var funcParams = [
  {
    planName: apiPlanName
    functionName: '${appName}-node-function-app'
    functionsRuntime: 'node'
    functionSubnetName: apiFunctionsSubnetName
    functionsSubnetAddressPrefix: apiFunctionsSubnetAddressPrefix
    privateEndpointSubnetName: apiPrivateEndpointSubnetName
    privateEndpointSubnetAddressPrefix: apiPrivateEndpointSubnetAddressPrefix

  }
]
module ustpFunctions './functions-deploy.bicep' = [for (config, i) in funcParams: if (deployFunctions) {
  name: '${appName}-backend-functions-module-${i}'
  scope: resourceGroup(apiFunctionsResourceGroupName)
  params: {
    location: location
    stackName: appName
    planName: funcParams[i].planName
    functionName: funcParams[i].functionName
    functionsRuntime: funcParams[i].functionsRuntime
    virtualNetworkName: virtualNetworkName
    virtualNetworkResourceGroupName: networkResourceGroupName
    functionSubnetName: funcParams[i].functionSubnetName
    functionsSubnetAddressPrefix: funcParams[i].functionsSubnetAddressPrefix
    privateEndpointSubnetName: funcParams[i].privateEndpointSubnetAddressPrefix
    privateEndpointSubnetAddressPrefix: funcParams[i].privateEndpointSubnetAddressPrefix
    privateDnsZoneName: privateDnsZoneName
    databaseConnectionString: databaseConnectionString
    sqlServerName: sqlServerName
    sqlServerResourceGroupName: sqlServerResourceGroupName
  }
  dependsOn: [
    ustpWebapp
  ]
}]

output webappName string = ustpWebapp.outputs.webappName
output functionAppName string = deployFunctions ? ustpFunctions[0].outputs.functionAppName : ''
