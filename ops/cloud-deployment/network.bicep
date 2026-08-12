// Network deployment entry template.
//
// Deploys the branch/main virtual network and subnets into the network resource
// group. Extracted from main.bicep so the network resource group can be
// provisioned as its own Azure Deployment Stack (CAMS-760, Option E). The
// app-scoped main.bicep now consumes these subnets via `existing` references rather
// than deploying them cross-scope, so this template MUST be deployed before main.bicep.
//
// The webapp private DNS zone used to be created here too, gated on deployDns.
// It moved to app-shared-setup.bicep (always a plain, never-stacked deployment)
// because this template IS a Deployment Stack for branches, and any resource
// declared here — even conditionally — is subject to that stack's
// manage/unmanage tracking. deployDns=false already stopped branches from ever
// creating the zone here, but it also meant nothing ever created it in the new
// shared branch network RG (rg-cams-network-dev) either, since only main's
// deployDns=true path ran. See app-shared-setup.bicep's header for the fix.
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

param networkResourceGroupName string = resourceGroup().name

// This default (and webappSubnetName/apiFunctionSubnetName/
// dataflowsSubnetName/privateEndpointSubnetName below) is computed via the
// shared functions in lib/naming.bicep, which main.bicep imports too — so the
// `existing` lookups there (for resources this template creates) can no
// longer silently drift out of sync.
param virtualNetworkName string = virtualNetworkNameFor(stackName)

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
    privateEndpointSubnetAddressPrefix: privateEndpointSubnetAddressPrefix
    privateEndpointSubnetName: privateEndpointSubnetName
    vnetAddressPrefix: vnetAddressPrefix
    virtualNetworkName: virtualNetworkName
  }
}

output privateEndpointSubnetId string = network.outputs.privateEndpointSubnetId
output apiFunctionSubnetId string = network.outputs.apiFunctionSubnetId
output webappSubnetId string = network.outputs.webappSubnetId
output dataflowsFunctionSubnetId string = network.outputs.dataflowsFunctionSubnetId
