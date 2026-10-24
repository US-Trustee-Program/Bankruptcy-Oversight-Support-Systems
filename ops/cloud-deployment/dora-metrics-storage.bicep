// Durable history for the DORA Metrics workflow's CSV reports
// (.github/workflows/dora-metrics.yml). Flexion CI/CD infrastructure only --
// deployed by deploy-dora-metrics-storage.yml, never part of main.bicep, so it
// is never deployed to USTP.
//
// Declared directly rather than through lib/storage/storage-account.bicep:
// that module outputs a listKeys() connection string, and this account
// disables shared-key access entirely. Every reader and writer authenticates
// with Entra ID (az storage ... --auth-mode login).

@description('Name for storage account. Limited to 3-24 characters, numbers and lower-case letters only.')
@minLength(3)
@maxLength(24)
param storageAccountName string

param location string = resourceGroup().location

param deployedAt string = utcNow()

@description('Name of the blob container for DORA metrics reports.')
param containerName string = 'dora-metrics'

@description('Days a deleted or overwritten blob remains recoverable.')
param deleteRetentionDays int = 30

var tags = {
  app: 'cams'
  component: 'dora-metrics'
  'deployed-at': deployedAt
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  name: 'default'
  parent: storageAccount
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: deleteRetentionDays
    }
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: containerName
  parent: blobService
}

output accountName string = storageAccount.name
output accountId string = storageAccount.id
