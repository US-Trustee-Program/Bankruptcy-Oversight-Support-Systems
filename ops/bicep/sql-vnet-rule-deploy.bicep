param prefixName string

@description('Sql server name to add new vnet rule')
param sqlServerName string

@description('Subnet resource id to allow access to the database server')
param subnetId string

resource sqlServer 'Microsoft.Sql/servers@2014-04-01' existing = {
  name: sqlServerName
}

resource vnetRule 'Microsoft.Sql/servers/virtualNetworkRules@2022-08-01-preview' = {
  parent: sqlServer
  name: 'allow-${prefixName}-${uniqueString(subnetId)}'
  properties: {
    virtualNetworkSubnetId: subnetId
    ignoreMissingVnetServiceEndpoint: false
  }
}
