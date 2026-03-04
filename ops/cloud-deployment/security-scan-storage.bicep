@description('Name for storage account. Limited to 3-24 characters, numbers and lower-case letters only.')
@minLength(3)
@maxLength(24)
param storageAccountName string

param location string = resourceGroup().location

param deployedAt string = utcNow()

var tags = {
  app: 'cams'
  component: 'security-scan'
  'deployed-at': deployedAt
}

@description('Name of the blob container for security scan results.')
param containerName string = 'security-scan-results'

@description('Name of the blob container for Snyk baseline SARIFs.')
param baselineContainerName string = 'snyk-baseline'

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

resource baselineContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  name: baselineContainerName
  parent: blobService
}

output accountName string = storage.outputs.accountName
output accountId string = storage.outputs.accountId
