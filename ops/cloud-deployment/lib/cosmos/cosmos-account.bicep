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
param allowedSubnets array = []

@description('WARNING: Set CosmosDb account for public access for all. Should be only enable for development environment.')
param allowAllNetworks bool = false

// Enable Azure Portal access
var azureIpRules = [
  {
    ipAddressOrRange: '52.244.48.71'
  }
  {
    ipAddressOrRange: '52.176.6.30'
  }
  {
    ipAddressOrRange: '52.169.50.45'
  }
  {
    ipAddressOrRange: '52.187.184.26'
  }
]

var allowedSubnetList = [for item in allowedSubnets: {
  id: item
  ignoreMissingVNetServiceEndpoint: false
}]

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-09-15' = {
  name: accountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: consistencyPolicy[defaultConsistencyLevel]
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    publicNetworkAccess: 'Enabled'
    isVirtualNetworkFilterEnabled: allowAllNetworks ? false : true
    virtualNetworkRules: allowAllNetworks ? [] : allowedSubnetList
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

output name string = account.name // URI e.g: https://<NAME>.documents.azure.us:443/
output id string = account.id
