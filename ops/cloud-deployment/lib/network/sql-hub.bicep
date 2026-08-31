/*
  Title:        sql-hub.bicep
  Description:  Hub side only: one VNet + subnet and ONE Private Endpoint
                against sql-ustp-cams, in the SQL server's own resource
                group. Creates no DNS zone. The endpoint itself registers
                NOTHING -- this template writes one explicit A record into
                each zone consumers already resolve through.

  Why one hub endpoint rather than one per consumer: the zone holds a single
  A record for the server's one canonical hostname, so each consumer's
  endpoint overwrites the last, and tearing one down deletes the record
  everyone else is using.

  Several resource groups hold a zone of this same name. Any ad-hoc `az`
  command against that zone name must RG-qualify with `-g`. Note that a THIRD
  such zone exists in the hub's own resource group, unlinked and empty; it is
  the rejected "hub owns its own zone" design (see deployment.md) and must
  never be linked to anything. _vnet-link-check.sh fails loud if a vnet is
  ever linked into a stray same-named zone.

  Deployed by ops/scripts/pipeline/azure-deploy-sql-hub-setup.sh. Not a
  Deployment Stack: this resource group is not otherwise stack-managed.

  ONE-TIME MIGRATION, ORDER MATTERS. The pre-existing privateDnsZoneGroup
  named 'default' is no longer declared here, and ARM incremental mode does
  not delete an undeclared child -- so it survives this deploy and must be
  removed by hand. Deleting it ALSO deletes the A record it owns, even one
  this template has since rewritten (metadata stripped, ttl changed): the
  group's own server-side recordSets list governs cleanup, not the record's
  metadata. Confirmed live on throwaway resources 2026-08-24. So:

    1. deploy  (safe with the group present -- it does not re-assert)
    2. az network private-endpoint dns-zone-group delete \
         -g <hub-rg> --endpoint-name pep-ustp-cams-sql-hub -n default
    3. deploy AGAIN to restore the record step 2 deleted   <-- MANDATORY

  Skipping step 3 leaves the branch zone (rg-cams-network-dev) with no
  record. NxDomainRedirect on the vnet links means that degrades silently to
  the public path rather than failing -- which is precisely the bug this
  template exists to fix, and it will not announce itself.
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

@description('Resource groups whose existing privatelink.database.usgovcloudapi.net zone gets an A record for the hub endpoint. One record is declared per entry; order does not matter and duplicates are ignored. Every zone listed must already exist -- a record is a child of its zone, so a missing one fails the deploy with ParentResourceNotFound. azure-deploy-sql-hub-setup.sh prechecks this.')
@minLength(1)
param consumerPrivateDnsZoneResourceGroups string[] = [
  'rg-cams-network'
  'rg-cams-network-dev'
]

@description('Overrides the hub endpoint\'s private IP. Leave empty (the default) to derive it from hubPrivateEndpointSubnetAddressPrefix, which is what keeps the address and the subnet from drifting apart as two independently-edited values. WRITE-ONCE -- Azure refuses to move a deployed endpoint\'s pinned address by any route (see subnet-private-endpoint.bicep), so changing this on the live hub means deleting and recreating the endpoint every environment depends on.')
param hubPrivateEndpointIpAddressOverride string = ''

// Azure reserves the first four addresses of every subnet (network, gateway,
// and two for DNS), so index 3 is the first assignable one -- and therefore
// exactly what dynamic allocation hands out to a subnet's only endpoint.
// Verified live: cidrHost('10.20.0.0/27', 3) == '10.20.0.4', which is the
// address the hub endpoint already holds. Deriving rather than hardcoding
// means re-addressing the subnet cannot silently leave the A records
// pointing into the old range; it fails loud on the write-once constraint
// instead, which is the correct outcome for a shared endpoint.
var hubPrivateEndpointIpAddress = empty(hubPrivateEndpointIpAddressOverride)
  ? cidrHost(hubPrivateEndpointSubnetAddressPrefix, 3)
  : hubPrivateEndpointIpAddressOverride

// Duplicates would compile to two nested deployments of the same name and
// fail validation with "is defined multiple times in a template" (confirmed
// live 2026-08-24). The list is operator-supplied via the workflow, so
// dedupe rather than make a repeated entry a deploy-time error.
var consumerZoneResourceGroups = union(consumerPrivateDnsZoneResourceGroups, [])

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

// The endpoint registers NOTHING itself. A privateDnsZoneGroup keys its
// registration by zone NAME, so an endpoint pointed at two zones that share a
// name writes ONE A record -- and it landed in the second zone, not the first,
// leaving main's zone empty while main was linked to it (cams-bz0n5). Every
// consumer zone gets an explicit record below instead, which is deterministic
// and independent of how many zones share the name.
//
// That requires a fixed endpoint address: a dynamically assigned one is not
// knowable when the record is authored.
module hubSqlPrivateEndpoint './subnet-private-endpoint.bicep' = {
  name: '${hubStackName}-private-endpoint-module'
  params: {
    stackName: hubStackName
    location: location
    privateLinkServiceId: resourceId(sqlServerResourceGroupName, 'Microsoft.Sql/servers', sqlServerName)
    privateLinkGroup: 'sqlServer'
    privateEndpointSubnetId: hubPrivateEndpointSubnet.outputs.subnetId
    staticPrivateIpAddress: hubPrivateEndpointIpAddress
    staticIpMemberName: 'sqlServer'
    // No privateDnsZone* params: with no zone group there is nothing to
    // register, and naming a zone here would imply otherwise.
    createDnsZoneGroup: false
    tags: tags
  }
}

// One record per consumer zone, each in its own resource group. Same name in
// several zones is fine here precisely because nothing is fanning a single
// registration out across them.
//
// dependsOn the endpoint is sufficient and not merely cosmetic: a failed
// endpoint update aborts these before they run, so a rejected address can
// never leave records pointing at an IP nothing serves (verified live). The
// converse race does not exist either -- the surviving zone group does NOT
// re-register when the endpoint is updated, so nothing overwrites these
// afterwards (checked immediately and again 45s later, 2026-08-24).
//
// Name is deliberately short: ARM caps a deployment name at 64 characters,
// and 'sql-hub-a-record-' leaves 47 for the resource group -- comfortably
// clear of the longest RG in play (bankruptcy-oversight-support-systems, 36)
// where the previous '${hubStackName}-a-record-' prefix left only 37 and
// would have overflowed.
module hubSqlARecords './private-dns-a-record.bicep' = [
  for rg in consumerZoneResourceGroups: {
    name: 'sql-hub-a-record-${rg}'
    scope: resourceGroup(rg)
    params: {
      privateDnsZoneName: sqlPrivateDnsZoneName
      recordName: sqlServerName
      ipAddress: hubPrivateEndpointIpAddress
    }
    dependsOn: [
      hubSqlPrivateEndpoint
    ]
  }
]

// No spoke peerings are declared here: each spoke creates its own, so a spoke's
// lifecycle can never redeploy the endpoint every environment depends on.

// Informational, for operators reading `az deployment group show` output and
// for any future template that needs to reference the hub. Nothing consumes
// them today -- the hub is deployed standalone, and its consumers address it
// by the fixed names above rather than by importing this module.
output hubVirtualNetworkId string = resourceId('Microsoft.Network/virtualNetworks', hubVirtualNetworkName)
output hubPrivateEndpointSubnetId string = hubPrivateEndpointSubnet.outputs.subnetId
// subnet-private-endpoint.bicep has no outputs of its own; the PE's name is
// deterministic ('pep-<stackName>', see that module), so its id is computed
// here rather than duplicating/extending that module for one extra output.
output hubPrivateEndpointId string = resourceId('Microsoft.Network/privateEndpoints', 'pep-${hubStackName}')
output hubPrivateEndpointIpAddress string = hubPrivateEndpointIpAddress
