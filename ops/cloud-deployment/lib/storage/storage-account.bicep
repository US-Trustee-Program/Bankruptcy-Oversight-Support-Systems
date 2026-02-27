param location string = resourceGroup().location

@description('Name for storage account. Limited to 3-24 characters, number and lower-case letters')
@minLength(3)
@maxLength(24)
param storageAccountName string

@description('Storage sku name of account type')
@allowed([
  'Premium_LRS'
  'Premium_ZRS'
  'Standard_GRS'
  'Standard_GZRS'
  'Standard_LRS'
  'Standard_RAGRS'
  'Standard_RAGZRS'
  'Standard_ZRS'
])
param sku string = 'Standard_LRS'

@allowed([
  'BlobStorage'
  'BlockBlobStorage'
  'FileStorage'
  'StorageV2'
])
param kind string = 'StorageV2'

param tags object = {}

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: sku
  }
  kind: kind
  properties: {
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

output accountName string = storageAccount.name
output accountId string = storageAccount.id
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
