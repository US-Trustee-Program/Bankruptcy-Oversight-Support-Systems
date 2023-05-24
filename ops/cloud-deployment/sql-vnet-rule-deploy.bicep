/*
  Description: Add a virtual network rule to existing sql server instance allow incoming traffic from specified subnet
*/

@description('Provide a name used for labeling related resources')
param stackName string

@description('Sql server name to add new vnet rule')
param sqlServerName string

@description('Subnet resource id to allow access to the database server')
param subnetId string

resource sqlServer 'Microsoft.Sql/servers@2014-04-01' existing = {
  name: sqlServerName
}

resource vnetRule 'Microsoft.Sql/servers/virtualNetworkRules@2022-08-01-preview' = {
  parent: sqlServer
  name: 'allow-${stackName}-${uniqueString(subnetId)}'
  properties: {
    virtualNetworkSubnetId: subnetId
    ignoreMissingVnetServiceEndpoint: false
  }
}
