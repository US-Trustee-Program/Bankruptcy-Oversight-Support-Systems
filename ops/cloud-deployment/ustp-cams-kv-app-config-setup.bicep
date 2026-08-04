/*
  This template is invoked automatically by main.bicep as part of the standard deployment workflow.
  It no longer needs to be run separately before deploying a new environment.

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

@description('When false, no role assignments are created (used for USTP deployments where the ADO service principal lacks role assignment permissions).')
param makeRoleAssignment bool = true

param location string = resourceGroup().location

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

// Same rationale as appConfigKeyvaultLock below — see that module's comment.
module appConfigIdentityLock './lib/identity/managed-identity-lock.bicep' = {
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

// Defense-in-depth against a repeat of GH #2749: a resource
// lock that survives even if a future change to the deploy/teardown scripts
// incorrectly wraps this shared Key Vault (or its managed identity) in a
// Deployment Stack again. This is independent of, not a replacement for, the
// script-level guards in az-delete-branch-resources.sh and the
// guard-app-deploy-not-stacked pre-commit hook.
module appConfigKeyvaultLock './lib/keyvault/keyvault-lock.bicep' = {
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
  }
}

module appConfigKeyvaultPrivateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${stackName}-kv-app-config-module'
  scope: resourceGroup(networkResourceGroup)
  params: {
    location: location
    privateLinkServiceId: appConfigKeyvault.outputs.vaultId
    stackName: stackName
    privateEndpointSubnetId: privateEndpointSubnetId
    privateLinkGroup: 'vault'
    privateDnsZoneName: keyvaultPrivateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    tags: tags
  }
}
