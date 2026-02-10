@description('Name for storage account. Limited to 3-24 characters, numbers and lower-case letters only.')
@minLength(3)
@maxLength(24)
param storageAccountName string

param location string = resourceGroup().location

param tags object = {}

@description('Name of the blob container for security scan results.')
param containerName string = 'security-scan-results'

module storage './lib/storage/storage-account.bicep' = {
  name: '${storageAccountName}-module'
  params: {
    storageAccountName: storageAccountName
    location: location
    tags: tags
    sku: 'Standard_LRS'
    kind: 'StorageV2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  name: '${storageAccountName}/default'
  dependsOn: [
    storage
  ]
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  name: containerName
  parent: blobService
}

output accountName string = storage.outputs.accountName
output accountId string = storage.outputs.accountId
