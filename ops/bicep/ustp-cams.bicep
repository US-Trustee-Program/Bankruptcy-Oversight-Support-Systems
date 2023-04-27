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

param deployBackendFunctions bool = true
param backendFunctionsResourceGroupName string = 'ustp-app-rg'
param backendFunctionsSubnetName string = '${virtualNetworkName}-function-app'
param backendFunctionsSubnetAddressPrefix string = '10.0.4.0/28'
param backendPrivateEndpointSubnetName string = '${virtualNetworkName}-function-pe'
param backendPrivateEndpointSubnetAddressPrefix string = '10.0.5.0/28'

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

module ustpBackendFunctions './functions-deploy.bicep' = if (deployBackendFunctions) {
  name: '${appName}-backend-functions-module'
  scope: resourceGroup(backendFunctionsResourceGroupName)
  params: {
    appName: appName
    location: location
    privateDnsZoneName: ustpNetwork.outputs.privateDnsZoneName
    virtualNetworkName: ustpNetwork.outputs.virtualNetworkName
    virtualNetworkResourceGroupName: networkResourceGroupName
    backendFunctionsSubnetName: backendFunctionsSubnetName
    backendFunctionsSubnetAddressPrefix: backendFunctionsSubnetAddressPrefix
    backendPrivateEndpointSubnetName: backendPrivateEndpointSubnetName
    backendPrivateEndpointSubnetAddressPrefix: backendPrivateEndpointSubnetAddressPrefix
    corsAllowOrigins: [ 'https://${ustpWebapp.outputs.webappUrl}' ]
    databaseConnectionString: databaseConnectionString
    sqlServerName: sqlServerName
    sqlServerResourceGroupName: sqlServerResourceGroupName
  }
  dependsOn: [
    ustpWebapp
  ]
}

output webappName string = ustpWebapp.outputs.webappName
output webappId string = ustpWebapp.outputs.webappId
output functionAppName string = ustpBackendFunctions.outputs.functionAppName
output functionAppId string = ustpBackendFunctions.outputs.functionAppId
