// Shared cross-scope resources for the app tier (CAMS-760, Option E / Slice 2).
//
// Deploys resources that are genuinely SHARED across main and every branch: the
// app-config Key Vault (+ its managed identity, its own private DNS zone, and
// per-secret role assignments) and the read-only SQL managed identity used by
// the API and dataflows function apps. Always a plain (non-stack) deployment
// for both main and branches — these resources must never be managed by a
// branch's Deployment Stack. An earlier version wrapped the whole app deploy
// (including these cross-scope resources) in a stack, and a branch teardown
// deleted the shared Key Vault + ~15 role assignments (GH #2749). This template
// must be deployed before main.bicep (which references the KV identity and SQL
// identity by name/id, not by bicep dependency, since they now live in a
// separate deployment).
targetScope = 'resourceGroup'

import {
  virtualNetworkName as virtualNetworkNameFor
  privateEndpointSubnetName as privateEndpointSubnetNameFor
  sqlIdentityName as sqlIdentityNameFor
} from './lib/naming.bicep'

param stackName string

param location string = resourceGroup().location

param isUstpDeployment bool = false

@description('Flag: determines the setup of DNS Zone, Link virtual networks to zone.')
param deployDns bool = true

param networkResourceGroupName string

// This default is computed via the shared functions in lib/naming.bicep,
// which network.bicep (which CREATES the vnet/subnet) and main.bicep also
// import — so the `existing` lookups below can no longer silently drift out
// of sync. app-shared-setup.bicep still needs its own copy of the vnet
// existence check in reusable-deploy.yml/reusable-build-info.yml (those
// derive the name in bash, not bicep) — keep those two in lockstep separately.
param virtualNetworkName string = virtualNetworkNameFor(stackName)

param privateEndpointSubnetName string = privateEndpointSubnetNameFor(stackName)

// Must be the network RG, not resourceGroup().name (this template's own
// app-RG scope) — the KV private DNS zone and its vnet link live in the
// network RG. A wrong RG here creates a second zone object with the same
// DNS name, which Azure rejects when linking the vnet to it.
param privateDnsZoneResourceGroup string = networkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

@description('Resource group containing the app-config Key Vault')
param kvAppConfigResourceGroupName string

@description('Name of the app-config Key Vault')
param kvAppConfigName string = 'kv-${stackName}'

@description('Name of the managed identity with read access to the keyvault storing application configurations.')
@secure()
param idKeyvaultAppConfiguration string

param sqlServerName string = ''

param sqlServerResourceGroupName string = ''

@description('Name for managed identity of database server.')
param sqlServerIdentityName string = ''

param sqlServerIdentityResourceGroupName string = ''

param deployedAt string = utcNow()

var tags = {
  app: 'cams'
  component: 'shared-setup'
  'deployed-at': deployedAt
}

// The virtual network and its subnets are deployed separately by network.bicep
// (its own Deployment Stack for branches). This template only needs the
// private-endpoint subnet, for the Key Vault's private endpoint.
resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2023-11-01' existing = {
  name: virtualNetworkName
  scope: resourceGroup(networkResourceGroupName)
}

resource privateEndpointSubnetExisting 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  name: privateEndpointSubnetName
  parent: ustpVirtualNetwork
}

module kvSetup './ustp-cams-kv-app-config-setup.bicep' = {
  name: '${stackName}-kv-setup-module'
  params: {
    stackName: stackName
    location: location
    deployDns: deployDns
    kvResourceGroup: kvAppConfigResourceGroupName
    kvName: kvAppConfigName
    networkResourceGroup: networkResourceGroupName
    virtualNetworkName: virtualNetworkName
    privateEndpointSubnetId: privateEndpointSubnetExisting.id
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    managedIdentityName: idKeyvaultAppConfiguration
    makeRoleAssignment: !isUstpDeployment
  }
}

// The read-only SQL managed identity used by both the API and dataflows
// function apps to authenticate to the SQL server. Its name comes from a
// fixed value (the AZ_SQL_IDENTITY_NAME secret) shared by main and every
// branch, so it is created exactly once here rather than per-function-app.
// Creating it inside a branch's app stack would let that branch's teardown
// delete the identity every other branch and main depend on — the same bug
// shape as the shared Key Vault incident above.
var sqlIdentityName = !empty(sqlServerIdentityName) ? sqlServerIdentityName : sqlIdentityNameFor(stackName)
var sqlIdentityRG = !empty(sqlServerIdentityResourceGroupName)
  ? sqlServerIdentityResourceGroupName
  : sqlServerResourceGroupName
var createSqlIdentity = !empty(sqlServerResourceGroupName) && !empty(sqlServerName) && !isUstpDeployment

module sqlManagedIdentity './lib/identity/managed-identity.bicep' = if (createSqlIdentity) {
  scope: resourceGroup(sqlIdentityRG)
  name: '${stackName}-sql-identity-module'
  params: {
    managedIdentityName: sqlIdentityName
    location: location
    tags: tags
  }
}
