// Shared cross-scope resources for the app tier (CAMS-760, Option E / Slice 2).
//
// Deploys resources that are genuinely SHARED across main and every branch: the
// app-config Key Vault (+ its managed identity, its own private DNS zone, its
// vnet link, and per-secret role assignments), the webapp/api/dataflows
// private DNS zone (privatelink.azurewebsites.us) — ZONE ONLY, not its vnet
// link, see below — and the read-only SQL managed identity used by the API
// and dataflows function apps. Always a plain (non-stack) deployment for both
// main and branches — these resources must never be managed by a branch's
// Deployment Stack. An earlier version wrapped the whole app deploy (including
// these cross-scope resources) in a stack, and a branch teardown deleted the
// shared Key Vault + ~15 role assignments (GH #2749). This template must be
// deployed before main.bicep (which references the KV identity and SQL
// identity by name/id, not by bicep dependency, since they now live in a
// separate deployment). Note network.bicep's subnets have no dependency on
// either DNS zone and may deploy before or after this template.
//
// The webapp zone used to be created by network.bicep, which is deployed as
// a Deployment Stack for branches — exactly the shape that got the shared KV
// deleted (see above). deployDns=false already suppressed branches from ever
// creating it there, but nothing ever created it in the new shared branch
// network RG (rg-cams-network-dev) either, since only main's deployDns=true
// path ever ran. Moving it here (always-plain, like the KV zone) lets every
// branch's first deploy safely create-if-missing without stack risk.
//
// Unlike the KV zone, the webapp zone's vnet link is NOT created here. The
// KV zone bundles zone+link+private-endpoint together because all three are
// deployed together in ustp-cams-kv-app-config-setup.bicep, called from this
// same plain deployment. The webapp zone has no private endpoint of its own
// here — the webapp/api/dataflows private endpoints that actually need this
// DNS resolution live in main.bicep, which IS a per-branch Deployment Stack
// for branches. The webapp zone's link is named per-stack
// (privatelink.azurewebsites.us-vnet-link-${stackName}), so it is safe to
// create inside that stack instead (see main.bicep for the module and
// rationale) — doing so makes the link self-cleaning on branch teardown,
// removing the need for az-delete-branch-resources.sh to delete it by hand.
targetScope = 'resourceGroup'

import {
  virtualNetworkName as virtualNetworkNameFor
  privateEndpointSubnetName as privateEndpointSubnetNameFor
  sqlIdentityName as sqlIdentityNameFor
} from './lib/naming.bicep'

param stackName string

param location string = resourceGroup().location

@description('Region for the Key Vault private endpoint specifically, since it must live in the same region as the (possibly separately-located) branch VNet/subnet it is placed into. Defaults to location, matching the previous, always-single-region behavior.')
param networkLocation string = location

param isUstpDeployment bool = false

@description('Matches main.bicep\'s createAlerts (ghaEnvironment == Main-Gov, i.e. Flexion staging). Together with isUstpDeployment, distinguishes the two standalone environments (staging, USTP prod) -- each keeps its own dedicated ACS resource via main.bicep -- from the dev tier (Flexion dev + every ephemeral PR branch), which shares one ACS resource created here.')
param createAlerts bool = false

@description('Resource group containing the shared Log Analytics workspace for alerts/bounce-poll. Required to create the dev-tier shared ACS alerting/bounce-poll resources.')
param analyticsResourceGroupName string = ''

@description('For staging/USTP prod only: resource ID of that environment\'s own existing Log Analytics workspace, used to source its ANALYTICS-WORKSPACE-CUSTOMER-ID-SHARED secret value. Unused for the dev tier, which creates its own shared workspace here.')
param analyticsWorkspaceId string = ''

@description('Subscription ID of the Log Analytics workspace named by analyticsWorkspaceId, for the staging/USTP-prod (non-dev-tier) path where that workspace may live in a different subscription than this deployment. Defaults to the current subscription, so same-subscription environments (incl. Flexion) are unaffected. Mirrors main.bicep\'s analyticsSubscriptionId for the same workspace.')
param analyticsSubscriptionId string = subscription().subscriptionId

@description('Custom domain FQDN for sending email. Leave empty to use Azure-managed subdomain.')
param customDomain string = ''

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

@description('Set true when the deploying pipeline has already confirmed a vnet link into the KV private DNS zone exists (see vnet-links.bicep) -- avoids a Conflict from trying to create a second, differently-named link.')
param vnetLinkAlreadyExists bool = false

param enableResourceLocks bool = false

// Not a param: nothing overrides it (the deploy script hardcodes the same
// literal locally rather than passing it through -- see
// azure-deploy-app-shared-setup.sh), and this value is also hardcoded in
// az-delete-branch-resources.sh -- keep all three in lockstep by hand.
// Matches the keyvaultPrivateDnsZoneName var in
// ustp-cams-kv-app-config-setup.bicep, which uses the same non-overridable
// shape for the same reason.
var webappPrivateDnsZoneName = 'privatelink.azurewebsites.us'

// Same non-overridable shape as webappPrivateDnsZoneName above, for the same
// reason -- EXCEPT az-delete-branch-resources.sh does NOT hardcode this
// literal: unlike the KV zone's PE (a plain, non-stack deployment that needs
// explicit teardown), this zone's per-branch vnet link (ustpSqlDnsZoneLink)
// and PE (apiSqlPrivateEndpoint/dataflowsSqlPrivateEndpoint) both live inside
// the branch's app Deployment Stack in main.bicep, so they self-clean on
// stack teardown the same way the webapp zone's link already does -- no
// defense-in-depth delete call needed here. Only the zone itself (this var,
// consumed below by the sqlDnsZone module) must stay in lockstep with the
// bash literal in azure-deploy-app-shared-setup.sh.
//
// This is the fixed Azure Government private-link DNS zone name for Azure
// SQL (Microsoft.Sql/servers, subresource sqlServer) -- see
// https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns
// for the public-vs-Gov cloud zone-name mapping.
var sqlPrivateDnsZoneName = 'privatelink.database.usgovcloudapi.net'

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

// The webapp/api/dataflows zone is shared the same way the KV zone is (one
// zone shared across main and every branch) -- see the file header. Unlike
// the KV zone, only the ZONE is created here now; its vnet link is a
// per-branch-uniquely-named resource (webappPrivateDnsZoneName-vnet-link-${stackName})
// and is instead created inside main.bicep, where it becomes stack-managed
// and self-cleans on branch teardown (see main.bicep's ustpWebappDnsZoneLink
// module for the rationale). This module is gated on deployDns: when false the
// module is skipped (create-only, no existing-lookup); the zone must already
// exist (created by prior main.bicep deploy, or bootstrapped for fresh Flexion
// branch RG by azure-deploy-app-shared-setup.sh). When true the zone is
// created if missing. USTP (deployDns=false) never creates this zone -- USTP
// owns its webapp zone out-of-band.
module webappDnsZone './lib/network/private-dns-zones.bicep' = if (deployDns) {
  name: '${stackName}-webapp-dns-zone-module'
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
  params: {
    stackName: stackName
    virtualNetworkId: ustpVirtualNetwork.id
    privateDnsZoneName: webappPrivateDnsZoneName
    deployDns: deployDns
    createVnetLink: false
  }
}

// SQL Private Link DNS zone, mirroring webappDnsZone above exactly: only the
// ZONE is created here (create-if-missing, shared across main and every
// branch); the per-branch vnet-link lives in main.bicep (ustpSqlDnsZoneLink)
// so it is stack-managed and self-cleans on branch teardown. This module is
// gated on deployDns (create-only, no existing-lookup). When deployDns=false
// the module is skipped; the zone must already exist (created by prior
// Flexion main deploy, or bootstrapped for fresh branch RG). When true the
// zone is created if missing. USTP (deployDns=false) never creates this zone
// -- USTP does not own SQL Server and uses ordinary SQL auth (not private
// link). SQL private link is Flexion-only.
module sqlDnsZone './lib/network/private-dns-zones.bicep' = if (deployDns) {
  name: '${stackName}-sql-dns-zone-module'
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
  params: {
    stackName: stackName
    virtualNetworkId: ustpVirtualNetwork.id
    privateDnsZoneName: sqlPrivateDnsZoneName
    deployDns: deployDns
    createVnetLink: false
  }
}

module kvSetup './ustp-cams-kv-app-config-setup.bicep' = {
  name: '${stackName}-kv-setup-module'
  params: {
    stackName: stackName
    location: location
    networkLocation: networkLocation
    deployDns: deployDns
    kvResourceGroup: kvAppConfigResourceGroupName
    kvName: kvAppConfigName
    networkResourceGroup: networkResourceGroupName
    virtualNetworkName: virtualNetworkName
    privateEndpointSubnetId: privateEndpointSubnetExisting.id
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    vnetLinkAlreadyExists: vnetLinkAlreadyExists
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
// Takes no subscription override: this never deploys on USTP (!isUstpDeployment),
// the only topology that would need a foreign subscription.
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

var isStandaloneEnvironment = createAlerts || isUstpDeployment
var isDevTier = !isStandaloneEnvironment
var sharedBounceWorkspaceName = 'law-cams-branches'

var acsCommunicationServiceName = isDevTier ? 'comms-cams-dev-shared' : '${stackName}-comms'
var acsEmailServiceName = isDevTier ? 'email-cams-dev-shared' : '${stackName}-email'
var acsConnectionStringSecretName = 'ACS-EMAIL-CONNECTION-STRING' // pragma: allowlist secret
var acsSenderAddressSecretName = 'ACS-EMAIL-SENDER-ADDRESS' // pragma: allowlist secret

module sharedBounceWorkspace 'lib/analytics/log-analytics-workspace.bicep' = if (isDevTier && !empty(analyticsResourceGroupName)) {
  name: '${stackName}-bounce-workspace-module'
  scope: resourceGroup(analyticsResourceGroupName)
  params: {
    workspaceName: sharedBounceWorkspaceName
    location: location
    tags: tags
  }
}

var acsAnalyticsWorkspaceId = isDevTier
  ? (!empty(analyticsResourceGroupName) ? sharedBounceWorkspace.outputs.id : '')
  : analyticsWorkspaceId

module acsEmail './lib/email/acs-email.bicep' = {
  name: '${stackName}-acs-email-module'
  params: {
    stackName: stackName
    communicationServiceName: acsCommunicationServiceName
    emailServiceName: acsEmailServiceName
    connectionStringSecretName: acsConnectionStringSecretName
    senderAddressSecretName: acsSenderAddressSecretName
    kvAppConfigName: kvAppConfigName
    kvAppConfigResourceGroupName: kvAppConfigResourceGroupName
    tags: tags
    customDomain: customDomain
    analyticsWorkspaceId: acsAnalyticsWorkspaceId
  }
  dependsOn: [
    kvSetup
  ]
}

module acsEmailLock './lib/email/acs-communication-service-lock.bicep' = if (enableResourceLocks) {
  name: '${stackName}-acs-email-lock-module'
  params: {
    communicationServiceName: acsCommunicationServiceName
    lockName: 'CanNotDelete-${acsCommunicationServiceName}'
    lockNotes: 'Protects the ACS Communication Service from accidental or automated deletion (GH #2749 bug shape).'
  }
  dependsOn: [
    acsEmail
  ]
}

module sharedBounceWorkspaceLock './lib/analytics/log-analytics-workspace-lock.bicep' = if (isDevTier && enableResourceLocks && !empty(analyticsResourceGroupName)) {
  name: '${stackName}-bounce-workspace-lock-module'
  scope: resourceGroup(analyticsResourceGroupName)
  params: {
    workspaceName: sharedBounceWorkspaceName
    lockName: 'CanNotDelete-law-cams-branches'
    lockNotes: 'Protects the shared dev-tier bounce-poll Log Analytics workspace from accidental or automated deletion (GH #2749 bug shape).'
  }
  dependsOn: [
    sharedBounceWorkspace
  ]
}

module sharedAnalyticsReaderRoleAssignment './lib/analytics/log-analytics-reader-role-assignment.bicep' =
  if (isDevTier && !empty(analyticsResourceGroupName)) {
    name: '${stackName}-analytics-reader-shared-module'
    scope: resourceGroup(analyticsResourceGroupName)
    params: {
      workspaceName: sharedBounceWorkspaceName
      principalId: kvSetup.outputs.principalId
    }
    dependsOn: [
      sharedBounceWorkspace
    ]
  }

resource existingAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing =
  if (!isDevTier && !empty(analyticsWorkspaceId) && !empty(analyticsResourceGroupName)) {
    name: last(split(analyticsWorkspaceId, '/'))
    scope: resourceGroup(analyticsSubscriptionId, analyticsResourceGroupName)
  }

// Grants the same app-config managed identity used by the dev-tier bounce
// poller (backend/lib/adapters/gateways/monitor/acs-bounce-query.gateway.ts)
// read access to staging/USTP prod's own existing analytics workspace. Before
// this, only the dev-tier path (sharedAnalyticsReaderRoleAssignment above)
// ever wired this role -- staging and USTP prod's bounce poll always hit a
// 403 InsufficientAccessError until someone granted it by hand.
module standaloneAnalyticsReaderRoleAssignment './lib/analytics/log-analytics-reader-role-assignment.bicep' =
  if (!isDevTier && !empty(analyticsWorkspaceId) && !empty(analyticsResourceGroupName)) {
    name: '${stackName}-analytics-reader-module'
    scope: resourceGroup(analyticsSubscriptionId, analyticsResourceGroupName)
    params: {
      workspaceName: last(split(analyticsWorkspaceId, '/'))
      principalId: kvSetup.outputs.principalId
    }
  }

var sharedAnalyticsWorkspaceCustomerId = isDevTier
  ? (!empty(analyticsResourceGroupName) ? sharedBounceWorkspace.outputs.customerId : '')
  : (existingAnalyticsWorkspace.?properties.?customerId ?? '')

var canWriteSharedAnalyticsCustomerId = isDevTier
  ? !empty(analyticsResourceGroupName)
  : (!empty(analyticsWorkspaceId) && !empty(analyticsResourceGroupName))

module sharedAnalyticsCustomerIdSecret './lib/keyvault/keyvault-secret.bicep' = if (canWriteSharedAnalyticsCustomerId) {
  name: '${stackName}-analytics-customer-id-shared-secret'
  scope: resourceGroup(kvAppConfigResourceGroupName)
  params: {
    keyVaultName: kvAppConfigName
    secretName: 'ANALYTICS-WORKSPACE-CUSTOMER-ID-SHARED' // pragma: allowlist secret
    secretValue: sharedAnalyticsWorkspaceCustomerId
  }
  dependsOn: [
    kvSetup
  ]
}
