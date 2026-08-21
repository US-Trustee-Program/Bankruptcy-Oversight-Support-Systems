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
resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: privateEndpoint
  name: dnsZoneGroupName
  properties: {
    privateDnsZoneConfigs: [
      {
        name: effectiveDnsZoneConfigName
        properties: {
          privateDnsZoneId: dnsZoneId
        }
      }
    ]
  }
}
