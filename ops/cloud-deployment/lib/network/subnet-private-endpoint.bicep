@description('Provide a name used for labeling related resources')
param stackName string

param location string = resourceGroup().location

@description('Resource id of existing service to be linked')
param privateLinkServiceId string

@description('Group for private link service (e.g., sites, sites-{slotName}, vault)')
param privateLinkGroup string

param privateEndpointSubnetId string

@description('Only consulted when createDnsZoneGroup is true. Defaults empty so callers that register their A records explicitly (createDnsZoneGroup false) need not supply a zone they never read -- passing one would imply this endpoint registers into it, which is exactly the misreading this module\'s history invites.')
param privateDnsZoneName string = ''

@description('Only consulted when createDnsZoneGroup is true. See privateDnsZoneName.')
param privateDnsZoneSubscriptionId string = ''

@description('Only consulted when createDnsZoneGroup is true. See privateDnsZoneName.')
param privateDnsZoneResourceGroup string = ''

param privateDnsZoneId string = ''

@description('Additional private DNS zone resource ids this endpoint should ALSO register its A record into, beyond privateDnsZoneId. A privateDnsZoneGroup accepts several configs, and one Private Endpoint registering into every zone its consumers already resolve through is what lets a shared endpoint be adopted without any consumer unlinking and relinking its VNet -- Azure rejects linking one VNet to two zones of the same name, so relinking would mean a hard resolution outage per consumer. Defaults empty, so existing single-zone call sites are byte-identical.')
param additionalPrivateDnsZoneIds array = []

@description('Name for the DNS zone group (default: "default", use "zone-group" for slots to match existing infrastructure)')
param dnsZoneGroupName string = 'default'

@description('Name for the DNS zone config entry inside the zone group. Defaults to the historical "privatelink_azurewebsites_\${stackName}" literal for backward compatibility with existing call sites (webapp/api/dataflows/slot/KV private endpoints) -- changing that default would rename the deployed config entry, which Azure treats as delete+recreate, not an in-place update. Pass an explicit value for new, non-webapp call sites (e.g. the SQL private endpoints) so the config entry name reflects what it actually is instead of being misleadingly labeled "azurewebsites".')
param dnsZoneConfigName string = ''

@description('When set, the endpoint takes this fixed private IP instead of one assigned dynamically. Required if anything declares a DNS A record pointing at this endpoint, since a dynamic address is not knowable at template-authoring time. Defaults empty, preserving dynamic allocation for existing call sites. WRITE-ONCE: see the immutability note above the privateEndpoint resource before changing a value that has already been deployed.')
param staticPrivateIpAddress string = ''

@description('Member of the target service this endpoint connects to, e.g. "sqlServer" or "sites". Only consulted when staticPrivateIpAddress is set, because an ipConfigurations entry must name the member its address belongs to. Defaults to privateLinkGroup, which is correct for every single-member service used here (sqlServer, blob, vault, sites all use memberName == groupId) -- so a caller that pins an address cannot silently produce an ipConfigurations entry with an empty memberName.')
param staticIpMemberName string = ''

@description('When false, no privateDnsZoneGroup is created and the endpoint registers nothing itself. Use for endpoints whose A records are declared explicitly instead -- Azure keys a zone-group registration by zone NAME, so an endpoint asked to register into two zones SHARING a name writes only one record, and not necessarily into the zone the caller listed first. Defaults true, preserving existing call sites.')
param createDnsZoneGroup bool = true

param tags object = {}

var effectiveDnsZoneConfigName = empty(dnsZoneConfigName) ? 'privatelink_azurewebsites_${stackName}' : dnsZoneConfigName

// staticPrivateIpAddress is WRITE-ONCE for the life of the endpoint. Pinning
// an address is an in-place update (the NIC resource and its ipConfig name
// both survive; only privateIPAllocationMethod flips Dynamic -> Static), but
// Azure then refuses to ever move it. Confirmed live on throwaway resources
// 2026-08-24, both ways round:
//
//   static -> a different static
//     PrivateEndpointWithStaticIpConfigurationsCannotChangeIpAddress
//     "User cannot change IP Addresses on these allocated IP configurations."
//   static -> dynamic (succeeds, keeps the same address) -> a different static
//     PrivateEndpointStaticIpMustMatchDynamicIpMapping
//     "Static Ip Configurations must have exact Ip address to membername
//      mapping for dynamic Ip Configurations."
//
// So the only way to change a deployed endpoint's address is to DELETE and
// recreate the endpoint. On a FRESH endpoint any free address in the subnet
// is accepted -- the constraint is update-only. Both failures are loud and
// abort the deployment before any dependent resource runs, so a wrong value
// can never leave DNS records pointing at an address nothing serves.
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'pep-${stackName}'
  location: location
  tags: tags
  properties: {
    privateLinkServiceConnections: [
      {
        name: 'pep-connection-${stackName}'
        properties: {
          privateLinkServiceId: privateLinkServiceId
          groupIds: [
            privateLinkGroup
          ]
          privateLinkServiceConnectionState: {
            status: 'Approved'
            actionsRequired: 'None'
          }
        }
      }
    ]
    manualPrivateLinkServiceConnections: []
    subnet: {
      id: privateEndpointSubnetId
    }
    ipConfigurations: empty(staticPrivateIpAddress)
      ? []
      : [
          {
            // A label only: Azure does NOT propagate it to the NIC's own
            // ipConfiguration, which keeps its generated
            // 'privateEndpointIpConfig.<guid>' name (confirmed live
            // 2026-08-24). So this name cannot trigger a rename/recreate.
            name: 'pep-ipconfig-${stackName}'
            properties: {
              groupId: privateLinkGroup
              memberName: empty(staticIpMemberName) ? privateLinkGroup : staticIpMemberName
              privateIPAddress: staticPrivateIpAddress
            }
          }
        ]
    customDnsConfigs: []
  }
}
// Also gated on createDnsZoneGroup: with no zone group there is no consumer
// for this lookup, and the zone params are then legitimately empty.
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = if (createDnsZoneGroup && empty(privateDnsZoneId)) {
  name: privateDnsZoneName
  scope: resourceGroup(privateDnsZoneSubscriptionId, privateDnsZoneResourceGroup)
}

var dnsZoneId = empty(privateDnsZoneId) ? privateDnsZone.id : privateDnsZoneId

// The primary config keeps its historical name unconditionally. Azure treats a
// renamed config entry as delete-then-recreate, not an in-place update, so the
// existing name must survive adding entries beside it -- otherwise every
// already-deployed endpoint would drop and re-register its A record on the next
// deploy. Additional entries are suffixed by index, which is stable as long as
// callers only ever append to additionalPrivateDnsZoneIds.
// Declared as its own variable, not inlined into the concat() below: bicep only
// permits a for-expression as the value of a resource, module, variable, or
// output declaration (BCP138), never as a function argument.
var additionalDnsZoneConfigEntries = [
  for (zoneId, i) in additionalPrivateDnsZoneIds: {
    name: '${effectiveDnsZoneConfigName}-additional-${i}'
    properties: {
      privateDnsZoneId: zoneId
    }
  }
]

var privateDnsZoneConfigEntries = concat(
  [
    {
      name: effectiveDnsZoneConfigName
      properties: {
        privateDnsZoneId: dnsZoneId
      }
    }
  ],
  additionalDnsZoneConfigEntries
)

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = if (createDnsZoneGroup) {
  parent: privateEndpoint
  name: dnsZoneGroupName
  properties: {
    privateDnsZoneConfigs: privateDnsZoneConfigEntries
  }
}
