@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Location for the Cosmos DB account.')
param location string = resourceGroup().location

@allowed([
  'Eventual'
  'ConsistentPrefix'
  'Session'
  'BoundedStaleness'
  'Strong'
])
@description('The default consistency level of the Cosmos DB account.')
param defaultConsistencyLevel string = 'Session'

@description('Specifies the MongoDB server version to use.')
@allowed([
  '4.2'
  '5.0'
  '6.0'
  '7.0'
])
param serverVersion string = '7.0'

param mongoSecretName string = 'MONGO-CONNECTION-STRING'

param keyVaultName string

param kvResourceGroup string


// Microsoft reference documentation, see https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels
var consistencyPolicy = {
  Eventual: {
    defaultConsistencyLevel: 'Eventual'
  }
  ConsistentPrefix: {
    defaultConsistencyLevel: 'ConsistentPrefix'
  }
  Session: {
    defaultConsistencyLevel: 'Session'
  }
  BoundedStaleness: {
    defaultConsistencyLevel: 'BoundedStaleness'
    maxStalenessPrefix: maxStalenessPrefix
    maxIntervalInSeconds: maxIntervalInSeconds
  }
  Strong: {
    defaultConsistencyLevel: 'Strong'
  }
}

@minValue(10)
@maxValue(2147483647)
@description('Max stale requests. Required for BoundedStaleness. Valid ranges, Single Region: 10 to 2147483647. Multi Region: 100000 to 2147483647.')
param maxStalenessPrefix int = 100000

@minValue(5)
@maxValue(86400)
@description('Max lag time (minutes). Required for BoundedStaleness. Valid ranges, Single Region: 5 to 84600. Multi Region: 300 to 86400.')
param maxIntervalInSeconds int = 300

@description('Backup policy configuration: Interval In Minutes')
param backupIntervalInMinutes int = 240
@description('Backup policy configuration: Retention Interval In Hours')
param backupRetentionIntervalInHours int = 8

@allowed([
  'Geo'
  'Zone'
  'Local'
])
@description('Backup policy configuration: Storage Redundancy')
param backupStorageRedundancy string = 'Geo'

@description('List of allowed subnet resource ids')
param allowedNetworks array = []

@description('WARNING: Set CosmosDb account for public access for all. Should be only enable for development environment.')
param allowAllNetworks bool = false

@description('List of allowed IP ranges on the USTP side')
param allowedIps array = []

param tags object = {}

var azureIpArray = [for item in allowedIps:{
  ipAddressOrRange: item
}]
// Enable Azure Portal access
var azureIpRules = concat(azureIpArray,[
  {
    ipAddressOrRange: '52.244.134.181'
  }
  {
    ipAddressOrRange: '52.244.176.112'
  }
  {
    ipAddressOrRange: '52.247.148.42'
  }
  {
    ipAddressOrRange: '52.247.163.6'
  }
])

var allowedNetworkList = [for item in allowedNetworks: {
  id: item
  ignoreMissingVNetServiceEndpoint: false
}]

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'MongoDB'
  properties: {
    consistencyPolicy: consistencyPolicy[defaultConsistencyLevel]
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: false
    apiProperties: {
      serverVersion:serverVersion
    }
    capabilities: [
      {
        name: 'EnableServerless'
      }
      {
        name: 'EnableMongo'
      }
      {
        name: 'EnableMongoRoleBasedAccessControl'
      }
      {
        name: 'EnableUniqueCompoundNestedDocs'
      }
    ]
    publicNetworkAccess: 'Enabled'
    isVirtualNetworkFilterEnabled: allowAllNetworks ? false : true
    virtualNetworkRules: allowAllNetworks ? [] : allowedNetworkList
    ipRules: allowAllNetworks ? [] : azureIpRules
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: backupIntervalInMinutes
        backupRetentionIntervalInHours: backupRetentionIntervalInHours
        backupStorageRedundancy: backupStorageRedundancy
      }
    }
  }
}

module keyvaultSecret '../../keyvault/keyvault-secret.bicep' = {
  name: '${accountName}-kv-secret-module'
  scope: resourceGroup(kvResourceGroup)
  params: {
    keyVaultName: keyVaultName
    secretName: mongoSecretName
    secretValue: account.listConnectionStrings().connectionStrings[0].connectionString
  }
}

output name string = account.name // URI e.g: https://<NAME>.documents.azure.us:443/
output id string = account.id
