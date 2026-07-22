// Network deployment entry template.
//
// Deploys the branch/main virtual network, subnets, and private DNS zone into the
// network resource group. Extracted from main.bicep so the network resource group
// can be provisioned as its own Azure Deployment Stack (CAMS-760, Option E). The
// app-scoped main.bicep now consumes these subnets via `existing` references rather
// than deploying them cross-scope, so this template MUST be deployed before main.bicep.
targetScope = 'resourceGroup'

param stackName string

param location string = resourceGroup().location

@description('Flag: determines deployment of vnet. Determined at workflow runtime. True on initial deployment outside of USTP.')
param deployVnet bool = false

@description('Flag: determines the setup of DNS Zone, Link virtual networks to zone.')
param deployDns bool = true

param networkResourceGroupName string = resourceGroup().name

param virtualNetworkName string = 'vnet-${stackName}'

@description('Array of Vnets to link to DNS Zone.')
param linkVnetIds array = []

param vnetAddressPrefix array = ['10.10.0.0/16']

param apiFunctionName string = '${stackName}-node-api'

param apiFunctionSubnetName string = 'snet-${apiFunctionName}'

param apiFunctionSubnetAddressPrefix string = '10.10.11.0/28'

param dataflowsFunctionName string = '${stackName}-dataflows'

param dataflowsSubnetAddressPrefix string = '10.10.13.0/28'

param dataflowsSubnetName string = 'snet-${dataflowsFunctionName}'

param webappName string = '${stackName}-webapp'

param webappSubnetName string = 'snet-${webappName}'

param webappSubnetAddressPrefix string = '10.10.10.0/28'

param privateEndpointSubnetName string = 'snet-${stackName}-private-endpoints'

param privateEndpointSubnetAddressPrefix string = '10.10.12.0/28'

param privateDnsZoneName string = 'privatelink.azurewebsites.us'

param privateDnsZoneResourceGroup string = networkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

module network './lib/network/ustp-cams-network.bicep' = {
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
    dataflowsFunctionName: dataflowsFunctionName
    dataflowsSubnetAddressPrefix: dataflowsSubnetAddressPrefix
    dataflowsSubnetName: dataflowsSubnetName
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

output privateEndpointSubnetId string = network.outputs.privateEndpointSubnetId
output apiFunctionSubnetId string = network.outputs.apiFunctionSubnetId
output webappSubnetId string = network.outputs.webappSubnetId
output dataflowsFunctionSubnetId string = network.outputs.dataflowsFunctionSubnetId
output privateDnsZoneId string = network.outputs.privateDnsZoneId
