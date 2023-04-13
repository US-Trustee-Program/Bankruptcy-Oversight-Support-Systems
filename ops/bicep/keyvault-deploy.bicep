@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('This is the built-in Key Vault Reader role. Default to See https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#reader')
param readerGuid string = 'acdd72a7-3385-48ef-bd42-f606fba81ae7'

// @description('Base-64 encoded .pfx to enable TLS for api')
// @maxLength(4096)
// @minLength(2048)
// @secure()
// param apiCertData string

// @description('TLS Cert password for api')
// @secure()
// param apiCertPass string

//@description('Store base 64 encoded .pfx and pass as secret')
// var certDataName = '${appName}-tlsCertData'
// resource ustpApiTlsCertData 'Microsoft.KeyVault/vaults/secrets@2022-11-01' = {
//   parent: ustpKeyVault
//   name: certDataName
//   properties: {
//     value: apiCertData
//     contentType: 'application/x-pkcs12'
//     attributes: {
//       enabled: true
//     }
//   }
// }
// var certPassName = '${appName}-tlsCertPass'
// resource ustpApiTlsCertPass 'Microsoft.KeyVault/vaults/secrets@2022-11-01' = {
//   parent: ustpKeyVault
//   name: certPassName
//   properties: {
//     value: apiCertPass
//     attributes: {
//       enabled: true
//     }
//   }
// }

// @description('This is the built-in Key Vault Administrator role. See https://docs.microsoft.com/azure/role-based-access-control/built-in-roles#key-vault-administrator')
// resource keyVaultAdministratorRoleDefinition 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
//   scope: subscription()
//   name: '00482a5a-887f-4fb3-b363-3b7fe8e74483'
// }


var keyVaultManagedIdentityName = '${appName}-mi-keyvault'
resource ustpKeyVaultManagedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: keyVaultManagedIdentityName
  location: location
}

var keyVaultName = '${appName}-kv'
resource ustpKeyVault 'Microsoft.KeyVault/vaults@2022-11-01' = {
  name: keyVaultName
  location: location
  properties: {
    accessPolicies: []
    publicNetworkAccess: 'Disabled'
    enableRbacAuthorization: false
    tenantId: tenant().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

@description('This is the built-in Key Vault Reader role.')
resource keyVaultReaderRoleDefinition 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: readerGuid
}

var keyVaultRoleAssignmentGuid = guid(ustpKeyVault.id, ustpKeyVaultManagedIdentity.id, keyVaultReaderRoleDefinition.id)
resource ustpKeyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: keyVaultRoleAssignmentGuid
  scope: ustpKeyVault
  properties: {
    roleDefinitionId: keyVaultReaderRoleDefinition.id
    principalId: ustpKeyVaultManagedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
