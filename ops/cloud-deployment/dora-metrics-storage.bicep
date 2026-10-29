// Durable history for the DORA Metrics workflow's CSV reports
// (.github/workflows/dora-metrics.yml). Flexion CI/CD infrastructure only --
// deployed by deploy-dora-metrics-storage.yml, never part of main.bicep, so it
// is never deployed to USTP.
//
// Declared directly rather than through lib/storage/storage-account.bicep:
// that module outputs a listKeys() connection string, and this account
// disables shared-key access entirely. Every reader and writer authenticates
// with Entra ID (az storage ... --auth-mode login).
//
// Public network access stays enabled on purpose: GitHub-hosted runners have no
// fixed IPs to allow-list, and with shared keys disabled every request still
// needs an Entra token holding a Storage Blob Data role.

@description('Name for storage account. Limited to 3-24 characters, numbers and lower-case letters only.')
@minLength(3)
@maxLength(24)
param storageAccountName string

param location string = resourceGroup().location

@description('Name of the blob container for DORA metrics reports.')
param containerName string = 'dora-metrics'

@description('Days a deleted or overwritten blob, or a deleted container, remains recoverable.')
param deleteRetentionDays int = 30

// No 'deployed-at' tag: that tag flags USTP removal candidates, and this
// account never lives in USTP. deploy-dora-metrics-storage.yml checks
// 'component' before modifying an existing account.
var tags = {
  app: 'cams'
  component: 'dora-metrics'
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
    // Set explicitly: Azure stores null when omitted, leaving it to a default
    // that could change.
    allowCrossTenantReplication: false
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
    // Storage Blob Data Contributor can delete the container itself, and blob
    // soft delete does not recover blobs inside a deleted container.
    containerDeleteRetentionPolicy: {
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
