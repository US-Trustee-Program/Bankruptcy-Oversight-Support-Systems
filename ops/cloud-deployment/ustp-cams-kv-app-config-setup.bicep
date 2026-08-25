/*
  This template is invoked automatically by app-shared-setup.bicep, which must run before main.bicep
  as part of the standard deployment workflow. It no longer needs to be run separately before
  deploying a new environment.

  For standalone/manual execution:
  az deployment group create -w \
    -g bankruptcy-oversight-support-systems
    --template-file ops/cloud-deployment/ustp-cams-kv-app-config-setup.bicep \
    --parameters stackName=cams-test \
                 virtualNetworkName=vnet-test \
                 kvResourceGroup=bankruptcy-oversight-support-systems \
                 networkResourceGroup=bankruptcy-oversight-support-systems \
                 privateEndpointSubnetId=<subnet-resource-id>

  What this template provisions:
  1. Managed identity with Key Vault Secrets User access scoped to individual secrets.
  2. Key Vault with network ACLs (public access disabled).
  3. Private DNS zone (privatelink.vaultcore.usgovcloudapi.net) linked to the virtual network.
  4. Private endpoint for the vault in the designated private endpoint subnet.

  Note: Key Vault secrets are provisioned manually and are not part of this template.
*/

@description('Application name will be use to name keyvault prepended by kv-')
param stackName string

param deployedAt string = utcNow()

param deployDns bool = true

// Microsoft.Authorization/* write permissions by deploy identity, as observed in CI:
//   Identity            roleAssignments/write   locks/write
//   Flexion Main-Gov    yes                     no
//   USTP/ADO            no                      no
// Both actions are excluded by Contributor's NotActions, but not identically
// across identities — don't assume one implies the other for a future
// Microsoft.Authorization/*-gated resource.
@description('When false, no role assignments are created (used for USTP deployments where the ADO service principal lacks role assignment permissions).')
param makeRoleAssignment bool = true

// Defense-in-depth against a repeat of the shared-KV deletion incident
// (GH #2749) would ideally layer this lock on top of the structural fix
// (this template's plain, non-stack deployment) and the pre-commit/script
// guards. But per the permissions matrix above, no deploy identity in any
// environment today (Flexion or USTP) has locks/write — so with the
// current default of false, this layer is dormant everywhere, not just
// disabled in some environments. Don't read the lock code below as an
// active control; the structural fix and guards are the only things
// currently enforcing this.
@description('When true, deploys CanNotDelete resource locks on the shared Key Vault and its managed identity. Defaults to false — see the permissions matrix above.')
param enableResourceLocks bool = false

param location string = resourceGroup().location

@description('Region for the Private Endpoint specifically, since it must live in the same region as the (possibly separately-located) branch VNet/subnet it is placed into, independent of the Key Vault itself which always stays on location. Defaults to location, matching the previous, always-single-region behavior.')
param networkLocation string = location

@description('Target resource group to provision App Configuration Keyvault')
param kvResourceGroup string

@description('Name of App Configuration Keyvault')
param kvName string = 'kv-${stackName}'

@description('Resource group the network subnet will reside')
param networkResourceGroup string

@description('Virtual network to create subnet for private endpoint resource')
param virtualNetworkName string

@description('Subnet ID of the private endpoint should exist within')
param privateEndpointSubnetId string

@description('Resource group of target Private DNS Zone')
param privateDnsZoneResourceGroup string = resourceGroup().name

@description('Subscription of target Private DNS Zone. Defaults to subscription of current deployment')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

@description('Set true when the deploying pipeline has already confirmed a vnet link into this zone exists (see vnet-links.bicep) -- avoids a Conflict from trying to create a second, differently-named link.')
param vnetLinkAlreadyExists bool = false

// Also hardcoded in az-delete-branch-resources.sh (kvPrivateDnsZoneName) to
// find and delete this zone's per-branch vnet link during teardown, and in
// azure-deploy-app-shared-setup.sh (kvPrivateDnsZoneName) to check for an
// existing vnet link before deploying — three copies total, can't share the
// literal across bash/bicep, keep all three in lockstep by hand.
var keyvaultPrivateDnsZoneName = 'privatelink.vaultcore.usgovcloudapi.net'

@description('Application Configuration network access control settings')
param kvNetworkAcls object = {
  defaultAction: 'Allow'
  bypass: 'AzureServices'
  ipRules: []
  virtualNetworkRules: []
}

@description('Managed identity with Secrets User role to individual secrets in the Keyvault')
param managedIdentityName string = 'id-kv-app-config-${uniqueString(stackName)}'

var tags = {
  app: 'cams'
  component: 'security'
  'deployed-at': deployedAt
}

// All secrets consumed by the API and Dataflows function apps via @Microsoft.KeyVault() references.
// Both apps have identical secret needs so they share one managed identity.
// Auth-method-specific secrets (MSSQL-USER/PASS vs MSSQL-CLIENT-ID) are both included here
// because the vault holds all secrets regardless of which auth method is active.
var functionAppSecrets = [
  'ADMIN-KEY'
  'MONGO-CONNECTION-STRING'
  'MSSQL-HOST'
  'MSSQL-DATABASE-DXTR'
  'MSSQL-ENCRYPT'
  'MSSQL-TRUST-UNSIGNED-CERT'
  'MSSQL-USER'
  'MSSQL-PASS'
  'MSSQL-CLIENT-ID'
  'ACMS-MSSQL-HOST'
  'ACMS-MSSQL-DATABASE'
  'ACMS-MSSQL-ENCRYPT'
  'ACMS-MSSQL-TRUST-UNSIGNED-CERT'
  'ACMS-MSSQL-USER'
  'ACMS-MSSQL-PASS'
  'ACMS-MSSQL-CLIENT-ID'
  'ATS-MSSQL-HOST'
  'ATS-MSSQL-DATABASE'
  'ATS-MSSQL-ENCRYPT'
  'ATS-MSSQL-TRUST-UNSIGNED-CERT'
  'ATS-MSSQL-USER'
  'ATS-MSSQL-PASS'
  'ATS-MSSQL-CLIENT-ID'
  'FEATURE-FLAG-SDK-KEY'
  'CAMS-USER-GROUP-GATEWAY-CONFIG'
  'OKTA-API-KEY'
  'ACS-EMAIL-CONNECTION-STRING'
  'ACS-EMAIL-SENDER-ADDRESS'
  'ANALYTICS-WORKSPACE-CUSTOMER-ID-SHARED'
]

module appConfigIdentity './lib/identity/managed-identity.bicep' = {
  name: '${stackName}-id-app-config-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    location: location
    managedIdentityName: managedIdentityName
    tags: tags
  }
}

// Defense-in-depth against a repeat of GH #2749: a branch's Deployment Stack
// teardown once deleted this shared managed identity because a stack owns
// every resource its template creates, in any resource group. This lock (and
// appConfigKeyvaultLock below, which shares this rationale) is independent of,
// not a replacement for, the script-level guards in
// az-delete-branch-resources.sh and the guard-app-deploy-not-stacked
// pre-commit hook — the primary GH #2749 mitigation is structural (shared
// resources are never stack-managed); these locks are a secondary safeguard.
// Gated on enableResourceLocks, not makeRoleAssignment — see the permissions
// matrix above for why these two Microsoft.Authorization/* writes can't be
// assumed to travel together.
module appConfigIdentityLock './lib/identity/managed-identity-lock.bicep' = if (enableResourceLocks) {
  name: '${stackName}-id-app-config-lock-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    managedIdentityName: managedIdentityName
    lockName: 'CanNotDelete-id-kv-app-config'
    lockNotes: 'Protects the shared Key Vault managed identity from accidental or automated deletion (GH #2749).'
  }
  dependsOn: [
    appConfigIdentity
  ]
}

module appConfigKeyvault './lib/keyvault/keyvault.bicep' = {
  name: '${stackName}-kv-app-config-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    location: location
    keyVaultName: kvName
    networkAcls: kvNetworkAcls
    tags: tags
  }
}

// Same rationale as appConfigIdentityLock above.
module appConfigKeyvaultLock './lib/keyvault/keyvault-lock.bicep' = if (enableResourceLocks) {
  name: '${stackName}-kv-app-config-lock-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    keyVaultName: kvName
    lockName: 'CanNotDelete-kv-app-config'
    lockNotes: 'Protects the shared app-config Key Vault from accidental or automated deletion (GH #2749). Do not remove without confirming branch teardown can never target this resource.'
  }
  dependsOn: [
    appConfigKeyvault
  ]
}

module appConfigSecretRoleAssignments './lib/keyvault/keyvault-secret-role-assignment.bicep' = [
  for secretName in functionAppSecrets: if (makeRoleAssignment) {
    name: '${stackName}-kv-secret-role-${uniqueString(secretName)}-${take(secretName, 10)}'
    scope: resourceGroup(kvResourceGroup)
    params: {
      keyVaultName: kvName
      secretName: secretName
      objectId: appConfigIdentity.outputs.principalId
    }
    dependsOn: [appConfigKeyvault]
  }
]

resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-11-01' existing = {
  name: virtualNetworkName
  scope: resourceGroup(networkResourceGroup)
}

// stackName (the per-branch/main-unique identifier), not kvName (the fixed,
// shared vault name), is used to name the private endpoint and its vnet link
// below: the Key Vault itself is shared, but each branch has its own isolated
// VNet and needs its own private endpoint + link into it. Passing kvName here
// previously gave every branch's private endpoint the same fixed name
// (pep-${kvName}), so concurrent or sequential branch deploys collided on one
// PE resource that can only ever point at one branch's subnet at a time.
module ustpPrivateDnsZone './lib/network/private-dns-zones.bicep' = {
  name: '${stackName}-private-dns-zone-module'
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
  params: {
    stackName: stackName
    virtualNetworkId: ustpVirtualNetwork.id
    privateDnsZoneName: keyvaultPrivateDnsZoneName
    deployDns: deployDns
    vnetLinkAlreadyExists: vnetLinkAlreadyExists
  }
}

// dependsOn is required here, not just implied by the matching
// privateDnsZoneName/ResourceGroup/SubscriptionId params: this module's
// subnet-private-endpoint.bicep resolves the zone via a plain `existing`
// lookup by name/scope, which Bicep does NOT treat as a dependency edge (only
// referencing a module's own symbolic outputs, e.g. ustpPrivateDnsZone.id,
// would). Without this, ARM has no guarantee it creates the zone (module
// ustpPrivateDnsZone above, when deployDns=true) before this module's DNS
// zone group tries to reference it -- harmless as long as the zone always
// already existed (main's has, for years), but a genuine race the first time
// a branch's deploy creates it fresh in this same deployment (CAMS-760
// zone-bootstrap fix). Confirmed live 2026-08-12: InvalidPrivateDnsZoneIds
// when the race was lost.
module appConfigKeyvaultPrivateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${stackName}-kv-app-config-module'
  scope: resourceGroup(networkResourceGroup)
  params: {
    location: networkLocation
    privateLinkServiceId: appConfigKeyvault.outputs.vaultId
    stackName: stackName
    privateEndpointSubnetId: privateEndpointSubnetId
    privateLinkGroup: 'vault'
    privateDnsZoneName: keyvaultPrivateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    tags: tags
  }
  dependsOn: [
    ustpPrivateDnsZone
  ]
}

output principalId string = appConfigIdentity.outputs.principalId
