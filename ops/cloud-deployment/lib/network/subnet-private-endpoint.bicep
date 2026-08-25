@description('Provide a name used for labeling related resources')
param stackName string

param location string = resourceGroup().location

@description('Resource id of existing service to be linked')
param privateLinkServiceId string

@description('Group for private link service (e.g., sites, sites-{slotName}, vault)')
param privateLinkGroup string

param privateEndpointSubnetId string

param privateDnsZoneName string

param privateDnsZoneSubscriptionId string

param privateDnsZoneResourceGroup string

param privateDnsZoneId string = ''

@description('Additional private DNS zone resource ids this endpoint should ALSO register its A record into, beyond privateDnsZoneId. A privateDnsZoneGroup accepts several configs, and one Private Endpoint registering into every zone its consumers already resolve through is what lets a shared endpoint be adopted without any consumer unlinking and relinking its VNet -- Azure rejects linking one VNet to two zones of the same name, so relinking would mean a hard resolution outage per consumer. Defaults empty, so existing single-zone call sites are byte-identical.')
param additionalPrivateDnsZoneIds array = []

@description('Name for the DNS zone group (default: "default", use "zone-group" for slots to match existing infrastructure)')
param dnsZoneGroupName string = 'default'

@description('Name for the DNS zone config entry inside the zone group. Defaults to the historical "privatelink_azurewebsites_\${stackName}" literal for backward compatibility with existing call sites (webapp/api/dataflows/slot/KV private endpoints) -- changing that default would rename the deployed config entry, which Azure treats as delete+recreate, not an in-place update. Pass an explicit value for new, non-webapp call sites (e.g. the SQL private endpoints) so the config entry name reflects what it actually is instead of being misleadingly labeled "azurewebsites".')
param dnsZoneConfigName string = ''

param tags object = {}

var effectiveDnsZoneConfigName = empty(dnsZoneConfigName) ? 'privatelink_azurewebsites_${stackName}' : dnsZoneConfigName

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
    ipConfigurations: []
    customDnsConfigs: []
  }
}
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = if (empty(privateDnsZoneId)) {
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

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: privateEndpoint
  name: dnsZoneGroupName
  properties: {
    privateDnsZoneConfigs: privateDnsZoneConfigEntries
  }
}
