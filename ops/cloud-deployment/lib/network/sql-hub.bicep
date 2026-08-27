/*
  Title:        sql-hub.bicep
  Description:  Hub side only: one VNet + subnet and ONE Private Endpoint
                against sql-ustp-cams, in the SQL server's own resource
                group. Creates no DNS zone -- the endpoint registers into
                the zones consumers already resolve through.

  Why one hub endpoint rather than one per consumer: the zone holds a single
  A record for the server's one canonical hostname, so each consumer's
  endpoint overwrites the last, and tearing one down deletes the record
  everyone else is using.

  Several resource groups hold a zone of this same name. Any ad-hoc `az`
  command against that zone name must RG-qualify with `-g`.

  Deployed by ops/scripts/pipeline/azure-deploy-sql-hub-setup.sh. Not a
  Deployment Stack: this resource group is not otherwise stack-managed.
*/

param location string = resourceGroup().location

@description('Name for the hub VNet.')
param hubVirtualNetworkName string = 'vnet-ustp-cams-sql-hub'

@description('Address space for the hub VNet. Must not overlap any spoke: peering rejects overlapping ranges. Main and legacy branches use 10.10.0.0/16, branch slots come from 10.128.0.0/12.')
param hubVnetAddressPrefix array = ['10.20.0.0/24']

@description('Name for the single subnet hosting the hub SQL Private Endpoint.')
param hubPrivateEndpointSubnetName string = 'snet-sql-hub-private-endpoint'

@description('Address prefix for the hub\'s private-endpoint subnet.')
param hubPrivateEndpointSubnetAddressPrefix string = '10.20.0.0/27'

@description('Name of the SQL server the hub Private Endpoint targets.')
param sqlServerName string = 'sql-ustp-cams'

@description('Resource group containing the SQL server. The hub deploys here too.')
param sqlServerResourceGroupName string = resourceGroup().name

@description('Fixed Azure Government private-link DNS zone name for Azure SQL.')
param sqlPrivateDnsZoneName string = 'privatelink.database.usgovcloudapi.net'

@description('Resource groups whose existing privatelink.database.usgovcloudapi.net zone the endpoint registers its A record into. Append, never reorder: the first entry becomes the primary DNS zone config and the rest are suffixed by index.')
param consumerPrivateDnsZoneResourceGroups array = [
  'rg-cams-network'
  'rg-cams-network-dev'
]

param tags object = {
  app: 'cams'
  component: 'network'
}

// Names the Private Endpoint and its DNS zone config entry. Not a Deployment
// Stack name -- this hub is a plain resource-group deployment.
var hubStackName = 'ustp-cams-sql-hub'

module hubVnet './vnet.bicep' = {
  name: '${hubStackName}-vnet-module'
  params: {
    vnetName: hubVirtualNetworkName
    vnetAddressPrefix: hubVnetAddressPrefix
    location: location
  }
}

module hubPrivateEndpointSubnet './subnet.bicep' = {
  name: '${hubStackName}-subnet-module'
  params: {
    virtualNetworkName: hubVirtualNetworkName
    subnetName: hubPrivateEndpointSubnetName
    subnetAddressPrefix: hubPrivateEndpointSubnetAddressPrefix
  }
  dependsOn: [
    hubVnet
  ]
}

// Registers into the zones consumers are ALREADY linked to rather than a
// hub-owned one. Azure rejects linking one VNet to two zones sharing a name, so
// a hub-owned zone could only be adopted by unlinking first -- and a consumer
// resolves nothing in between. Registering into the existing zones makes
// adoption a single in-place A-record update per zone.
var consumerPrivateDnsZoneIds = [
  for rg in consumerPrivateDnsZoneResourceGroups: resourceId(
    subscription().subscriptionId,
    rg,
    'Microsoft.Network/privateDnsZones',
    sqlPrivateDnsZoneName
  )
]

module hubSqlPrivateEndpoint './subnet-private-endpoint.bicep' = {
  name: '${hubStackName}-private-endpoint-module'
  params: {
    stackName: hubStackName
    location: location
    privateLinkServiceId: resourceId(sqlServerResourceGroupName, 'Microsoft.Sql/servers', sqlServerName)
    privateLinkGroup: 'sqlServer'
    privateEndpointSubnetId: hubPrivateEndpointSubnet.outputs.subnetId
    privateDnsZoneName: sqlPrivateDnsZoneName
    privateDnsZoneSubscriptionId: subscription().subscriptionId
    privateDnsZoneResourceGroup: consumerPrivateDnsZoneResourceGroups[0]
    privateDnsZoneId: consumerPrivateDnsZoneIds[0]
    additionalPrivateDnsZoneIds: skip(consumerPrivateDnsZoneIds, 1)
    dnsZoneConfigName: 'privatelink_database_${hubStackName}'
    tags: tags
  }
}

// No spoke peerings are declared here: each spoke creates its own, so a spoke's
// lifecycle can never redeploy the endpoint every environment depends on.

output hubVirtualNetworkId string = resourceId('Microsoft.Network/virtualNetworks', hubVirtualNetworkName)
output hubPrivateEndpointSubnetId string = hubPrivateEndpointSubnet.outputs.subnetId
// subnet-private-endpoint.bicep has no outputs of its own; the PE's name is
// deterministic ('pep-<stackName>', see that module), so its id is computed
// here rather than duplicating/extending that module for one extra output.
output hubPrivateEndpointId string = resourceId('Microsoft.Network/privateEndpoints', 'pep-${hubStackName}')
output sqlPrivateDnsZoneIds array = consumerPrivateDnsZoneIds
