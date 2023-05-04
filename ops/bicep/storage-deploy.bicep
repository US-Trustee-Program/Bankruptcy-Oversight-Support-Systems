param location string = resourceGroup().location

@description('Name for storage account. Limited to 3-24 characters, number and letters')
@minLength(3)
@maxLength(24)
param storageAccountName string

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS' // Other options :: Standard_LRS | Standard_GRS | Standard_RAGRS
  }
  kind: 'Storage'
  properties: {
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

output accountName string = storageAccount.name
