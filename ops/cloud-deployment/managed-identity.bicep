@description('Specifies the Azure location where the resources should be created.')
param location string = resourceGroup().location

param managedIdentityName string

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: managedIdentityName
  location: location
}

output clientId string = managedIdentity.properties.clientId
output principleId string = managedIdentity.properties.principalId
