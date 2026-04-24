@description('Name of the key vault containing the secret.')
param keyVaultName string

@description('Name of the secret to scope the role assignment to.')
param secretName string

@description('Principal ID of the managed identity or service principal to grant access.')
param objectId string

var keyVaultSecretsUserId = '4633458b-17de-408a-b874-0445c86b69e6'

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: kv
  name: secretName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultSecretsUserId, objectId, secret.id)
  scope: secret
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserId)
    principalId: objectId
    principalType: 'ServicePrincipal'
  }
}
