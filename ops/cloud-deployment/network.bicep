// Network deployment entry template.
//
// Deploys the branch/main virtual network, subnets, and private DNS zone into the
// network resource group. Extracted from main.bicep so the network resource group
// can be provisioned as its own Azure Deployment Stack (CAMS-760, Option E). The
// app-scoped main.bicep now consumes these subnets via `existing` references rather
// than deploying them cross-scope, so this template MUST be deployed before main.bicep.
targetScope = 'resourceGroup'

import {
  virtualNetworkName as virtualNetworkNameFor
  webappName as webappNameFor
  webappSubnetName as webappSubnetNameFor
  apiFunctionName as apiFunctionNameFor
  apiFunctionSubnetName as apiFunctionSubnetNameFor
  dataflowsFunctionName as dataflowsFunctionNameFor
  dataflowsSubnetName as dataflowsSubnetNameFor
  privateEndpointSubnetName as privateEndpointSubnetNameFor
} from './lib/naming.bicep'

param stackName string

param location string = resourceGroup().location

@description('Flag: determines deployment of vnet. Determined at workflow runtime. True on initial deployment outside of USTP.')
param deployVnet bool = false

@description('Flag: determines the setup of DNS Zone, Link virtual networks to zone.')
param deployDns bool = true

param networkResourceGroupName string = resourceGroup().name

// This default (and webappSubnetName/apiFunctionSubnetName/
// dataflowsSubnetName/privateEndpointSubnetName below) is computed via the
// shared functions in lib/naming.bicep, which main.bicep imports too — so the
// `existing` lookups there (for resources this template creates) can no
// longer silently drift out of sync (PR #2757 review).
param virtualNetworkName string = virtualNetworkNameFor(stackName)

@description('Array of Vnets to link to DNS Zone.')
param linkVnetIds array = []

param vnetAddressPrefix array = ['10.10.0.0/16']

param apiFunctionName string = apiFunctionNameFor(stackName)

param apiFunctionSubnetName string = apiFunctionSubnetNameFor(stackName)

param apiFunctionSubnetAddressPrefix string = '10.10.11.0/28'

param dataflowsFunctionName string = dataflowsFunctionNameFor(stackName)

param dataflowsSubnetAddressPrefix string = '10.10.13.0/28'

param dataflowsSubnetName string = dataflowsSubnetNameFor(stackName)

param webappName string = webappNameFor(stackName)

param webappSubnetName string = webappSubnetNameFor(stackName)

param webappSubnetAddressPrefix string = '10.10.10.0/28'

param privateEndpointSubnetName string = privateEndpointSubnetNameFor(stackName)

param privateEndpointSubnetAddressPrefix string = '10.10.12.0/28'

param privateDnsZoneName string = 'privatelink.azurewebsites.us'

// GUARD (CAMS-760, GH #2749 bug shape, currently latent/inert): defaulting to
// networkResourceGroupName keeps the zone in the SAME RG this template is
// deployed into. For a branch deploy that RG is stacked (az stack group
// create), and a stack manages every resource its template creates in ANY
// resource group — so if this (or privateDnsZoneSubscriptionId below) is ever
// overridden to point a BRANCH deploy at a shared RG/subscription, the zone
// becomes stack-managed and that branch's own teardown would delete it,
// breaking DNS for every other branch/main sharing it. No caller currently
// has a way to override this for a branch deploy (azure-deploy-network.sh
// exposes no such flag), so this is safe today — add a CanNotDelete lock
// (mirroring keyvault-lock.bicep) or an explicit script-level guard FIRST,
// before ever wiring up an override that could reach a branch (stacked) deploy.
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
