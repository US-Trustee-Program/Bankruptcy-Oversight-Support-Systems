/*
  Title:        sql-hub.bicep
  Description:  Goal 1 of the SQL Private Link hub-and-spoke rework
                (cams-vwsp3). Stands up the hub side ONLY: one hub VNet +
                subnet, one Private Endpoint against sql-ustp-cams, and one
                hub-owned Private DNS Zone -- all in the SQL server's own
                resource group (bankruptcy-oversight-support-systems), not
                in any of CAMS's app/network resource groups.

  Why a hub, not another per-consumer PE: today main and every branch each
  mint their OWN Private Endpoint against sql-ustp-cams, all registering
  into a shared zone that holds only ONE A record for the server's single
  canonical hostname at a time -- so a second consumer's PE registering
  silently overwrites the first's, breaking whichever consumer isn't
  "currently registered" (confirmed live bug). Collapsing to exactly ONE
  Private Endpoint here removes the multi-registrant race entirely: every
  consumer will (in a later goal) reach this same PE via VNet peering
  instead of creating its own.

  This is intentionally NOT wired into main.bicep's networkResourceGroupName/
  privateDnsZoneResourceGroup params (rg-cams-network / rg-cams-network-dev):
  this hub's zone/PE live in bankruptcy-oversight-support-systems, a
  genuinely different resource group with a different lifecycle -- deployed
  once, directly, not per-branch. Peering main/branches to this hub and
  migrating them off their existing PEs/zones are explicitly later goals;
  this file only stands up the hub itself.

  Deploy standalone via a plain `az deployment group create` against
  bankruptcy-oversight-support-systems (see
  ops/scripts/pipeline/azure-deploy-sql-hub-setup.sh) -- no Deployment Stack,
  since this resource group is not otherwise stack-managed.

  Migration-window caveat: until consumers are migrated off the existing
  rg-cams-network/rg-cams-network-dev zones (see below), three RG-scoped
  instances of the identically-named privatelink.database.usgovcloudapi.net
  zone coexist in this subscription. Any ad-hoc `az` command touching this
  zone name during that window MUST RG-qualify (`-g`) to avoid operating on
  the wrong instance.

  Goal 2 addition (spokeVirtualNetworks / hubToSpokePeering below): gives
  this file a NEW capability -- creating the HUB SIDE of a VNet peering
  against each onboarded spoke. Ownership design: a bidirectional peering is
  two independent resources, one nested under each VNet in that VNet's own
  RG (see vnet-peering.bicep's header for the full mechanics). The spoke
  side (main's, or a branch's) is created by that spoke's OWN deploy
  (main.bicep's createMainHubPeering-gated module call, for main); the HUB
  side is logically owned by the hub, not by any spoke's deploy, because
  bankruptcy-oversight-support-systems is this hub's own RG/lifecycle, not
  any spoke's -- a spoke's deploy has no business holding write access to
  it, and this hub's deploy already treats "grow this RG's contents over
  time via a re-run" as the norm (the PE/zone above were stood up the same
  way). Concretely: onboarding a new spoke means appending one entry to
  spokeVirtualNetworks and re-running this deployment. Because this is a
  plain (non-stack) `az deployment group create`/`what-if` using ARM's
  default Incremental mode, re-running with an appended array only adds the
  new spoke's peering resource -- it does not touch or remove any
  previously-created entry's resource, even though that entry's peering
  isn't declared inline as its own module call. Entries should only ever be
  appended (never reordered or removed) so a later switch to Complete mode,
  or any other stricter deployment, can't misread an incidental array-order
  change as "these spokes were deliberately un-peered."
*/

param location string = resourceGroup().location

@description('Name for the new hub VNet, created in the SQL server\'s own resource group (bankruptcy-oversight-support-systems) -- deliberately NOT in rg-cams-network/rg-cams-network-dev, since the SQL server is the architectural center this VNet exists to serve, not a consumer\'s network.')
param hubVirtualNetworkName string = 'vnet-ustp-cams-sql-hub'

@description('Address space for the hub VNet. Every existing VNet in this subscription (vnet-ustp-cams, all vnet-ustp-cams-dev* branch VNets) uses 10.10.0.0/16, so this hub picks an address space outside that block to avoid overlap -- required because VNet peering (the next goal) rejects overlapping ranges. Only one subnet is ever needed here (one PE), so a /24 is already generous headroom, not a sizing decision that needs revisiting later.')
param hubVnetAddressPrefix array = ['10.20.0.0/24']

@description('Name for the single subnet hosting the hub SQL Private Endpoint.')
param hubPrivateEndpointSubnetName string = 'snet-sql-hub-private-endpoint'

@description('Address prefix for the hub\'s private-endpoint subnet. A /27 (32 addresses) comfortably covers the one Private Endpoint this subnet will ever host, carved out of the /24 VNet range above.')
param hubPrivateEndpointSubnetAddressPrefix string = '10.20.0.0/27'

@description('Name of the SQL server the hub Private Endpoint targets.')
param sqlServerName string = 'sql-ustp-cams'

@description('Resource group containing the SQL server -- also where this entire hub (VNet, subnet, PE, DNS zone) is deployed, since the SQL server is this hub\'s architectural center.')
param sqlServerResourceGroupName string = resourceGroup().name

@description('Fixed Azure Government private-link DNS zone name for Azure SQL.')
param sqlPrivateDnsZoneName string = 'privatelink.database.usgovcloudapi.net'

@description('Resource groups holding the EXISTING privatelink.database.usgovcloudapi.net zones that consumers already resolve through -- main\'s (rg-cams-network) and the branches\' (rg-cams-network-dev). The hub Private Endpoint registers its A record into every one of them, rather than into a new hub-owned zone. See the header for why. Order matters only in that entries should be appended, never reordered: the first becomes the endpoint\'s primary DNS zone config and the rest are suffixed by index.')
param consumerPrivateDnsZoneResourceGroups array = [
  'rg-cams-network'
  'rg-cams-network-dev'
]

param tags object = {
  app: 'cams'
  component: 'network'
}

@description('Spoke VNets to peer the hub with -- one hub-side peering resource per entry (see header above for the append-only, re-run-to-onboard mechanism). Each entry: { name: <spoke VNet name>, resourceGroupName: <spoke VNet\'s resource group> }. Empty by default so a bare hub deploy/what-if (Goal 1 shape) remains a no-op for peering -- Goal 2 onboards spokes by passing this array, it does not change the default.')
param spokeVirtualNetworks array = []

// Fixed identity used purely for labeling/naming the Private Endpoint
// (subnet-private-endpoint.bicep's pep-<stackName> / pep-connection-<stackName>
// convention) and the DNS zone config entry name. Not a Deployment Stack name --
// this hub is deployed as a plain resource-group deployment. A var, not a param,
// since this hub has exactly one identity and is never deployed with an
// overridden name.
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

// This hub deliberately creates NO DNS zone of its own. It registers into the
// zones consumers are ALREADY linked to, computed below from
// consumerPrivateDnsZoneResourceGroups.
//
// An earlier revision minted a third object named
// privatelink.database.usgovcloudapi.net in this RG, alongside the existing ones
// in rg-cams-network and rg-cams-network-dev, and left migrating consumers onto
// it as a later goal. That migration is not possible without an outage: Azure
// rejects linking one VNet to two zones sharing a name (confirmed live), so each
// consumer would have to UNLINK from its current zone before it could link to
// this one, and between those two operations it resolves nothing. Registering
// into the existing zones instead makes adoption a single in-place A-record
// update per zone, with rollback the same shape, and removes the three-
// identically-named-zones hazard entirely.
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

// Hub-side peering resource for each onboarded spoke -- see header for why
// this lives here (hub-owned RG) rather than in each spoke's own deploy, and
// why appending to spokeVirtualNetworks is the onboarding mechanism. No
// `dependsOn: [hubVnet]` needed: hubVnet is a module (already-created
// resource by the time any spoke onboards, in practice), and this module's
// `existing` lookup of hubVirtualNetworkName inside vnet-peering.bicep
// resolves by name at deploy time regardless of module ordering within this
// same deployment.
module hubToSpokePeering './vnet-peering.bicep' = [
  for spoke in spokeVirtualNetworks: {
    name: '${hubStackName}-peering-to-${spoke.name}-module'
    params: {
      localVirtualNetworkName: hubVirtualNetworkName
      remoteVirtualNetworkId: resourceId(spoke.resourceGroupName, 'Microsoft.Network/virtualNetworks', spoke.name)
      peeringName: 'peer-${hubVirtualNetworkName}-to-${spoke.name}'
    }
  }
]

output hubVirtualNetworkId string = resourceId('Microsoft.Network/virtualNetworks', hubVirtualNetworkName)
output hubPrivateEndpointSubnetId string = hubPrivateEndpointSubnet.outputs.subnetId
// subnet-private-endpoint.bicep has no outputs of its own; the PE's name is
// deterministic ('pep-<stackName>', see that module), so its id is computed
// here rather than duplicating/extending that module for one extra output.
output hubPrivateEndpointId string = resourceId('Microsoft.Network/privateEndpoints', 'pep-${hubStackName}')
output sqlPrivateDnsZoneIds array = consumerPrivateDnsZoneIds
