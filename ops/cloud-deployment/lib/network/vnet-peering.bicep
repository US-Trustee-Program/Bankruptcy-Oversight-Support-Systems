/*
  Title:        vnet-peering.bicep
  Description:  Goal 2 of the SQL Private Link hub-and-spoke rework
                (cams-vwsp3). A reusable module that declares ONE side of a
                bidirectional VNet peering: the
                Microsoft.Network/virtualNetworks/virtualNetworkPeerings
                resource owned by "this side's" VNet, pointing at the other
                side by resource ID.

  Why one resource per module call, not two: Azure models a bidirectional
  peering as TWO separate peering resources -- one nested under each VNet,
  each living in that VNet's own resource group. Declaring both sides from a
  single deployment would mean that deployment needs WRITE access to BOTH
  resource groups, which is more privilege than either side's deploy should
  need (main's/a branch's deploy has no business holding write access to
  bankruptcy-oversight-support-systems, the hub's RG, and vice versa). This
  module instead declares only the LOCAL side -- the peering resource nested
  under localVirtualNetworkName, in whatever resource group the caller's
  `scope:` on the module points at -- and references the far side purely by
  resourceId string. No `existing` lookup of the remote VNet is needed (and
  none is declared here) because a peering resource only needs to embed the
  remote VNet's ID, not read any of its properties; Azure separately enforces
  the requesting principal has the `Microsoft.Network/virtualNetworks/peer/
  action` permission on that remote VNet, which is a narrower grant than RG
  write access.

  Getting a full bidirectional peering therefore means calling this module
  TWICE, once from each side's own deployment, each time scoped to that
  side's own resource group:
    - Main/branch side: called from main.bicep, scoped to
      networkResourceGroupName (rg-cams-network / rg-cams-network-dev),
      localVirtualNetworkName = that VNet, remoteVirtualNetworkId = the
      hub's fixed, known resource ID.
    - Hub side: called from sql-hub.bicep (once per onboarded spoke, via its
      spokeVirtualNetworks array param -- see that file's header for the
      hub-side-ownership rationale), scoped to the hub's own RG
      (bankruptcy-oversight-support-systems), localVirtualNetworkName =
      vnet-ustp-cams-sql-hub, remoteVirtualNetworkId = that spoke's VNet ID.

  Peering only becomes "Connected" (vs. "Initiated") once BOTH sides exist,
  so the two calls above are independent deployments that converge on a
  working peering once both have run -- there is no ordering requirement
  between them (Azure accepts either side first, in an "Initiated" state).
*/

@description('Name of the VNet, in the CURRENT deployment scope, that will own this peering resource. This is the "local" side -- the module\'s caller determines which side that is via the `scope:` on its module call.')
param localVirtualNetworkName string

@description('Resource ID of the other side\'s VNet. A full resource ID string, not a name+RG pair, because callers reference VNets outside their own deployment (e.g. main.bicep referencing the already-deployed hub VNet by its fixed, known ID) without needing an `existing` lookup or cross-scope read access.')
param remoteVirtualNetworkId string

@description('Name for this peering resource. Must be unique among localVirtualNetworkName\'s own peerings -- callers should encode both VNet names into it (e.g. peer-vnet-ustp-cams-to-vnet-ustp-cams-sql-hub) so the corresponding resource on the far side (created by a separate module call, see header) is easy to correlate during troubleshooting even though the two peering resources are independently named.')
param peeringName string

@description('Allows the local VNet to resolve/reach resources in the remote VNet (and vice versa, once the remote side\'s matching peering resource also exists). Fixed true for this hub-and-spoke design -- that is the entire point of peering main/branches to the SQL hub.')
param allowVirtualNetworkAccess bool = true

// Fixed at false, not params -- neither the hub nor any consumer VNet in
// this design forwards traffic through a network appliance, uses the other
// side's gateway (ExpressRoute/VPN), or offers its own gateway for the other
// side's use; this connection is purely to let consumers reach the hub's SQL
// Private Endpoint directly. Neither of this module's two call sites
// (sql-hub.bicep's hubToSpokePeering, main.bicep's mainHubPeering) has ever
// needed a non-default value here, and none is expected to for this
// SQL-reachability use case -- same non-overridable shape as
// sqlPrivateDnsZoneName in app-shared-setup.bicep.
var allowForwardedTraffic = false
var useRemoteGateways = false
var allowGatewayTransit = false

resource localVirtualNetwork 'Microsoft.Network/virtualNetworks@2023-11-01' existing = {
  name: localVirtualNetworkName
}

resource peering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: localVirtualNetwork
  name: peeringName
  properties: {
    allowVirtualNetworkAccess: allowVirtualNetworkAccess
    allowForwardedTraffic: allowForwardedTraffic
    useRemoteGateways: useRemoteGateways
    allowGatewayTransit: allowGatewayTransit
    remoteVirtualNetwork: {
      id: remoteVirtualNetworkId
    }
  }
}

output peeringId string = peering.id
output peeringName string = peering.name
