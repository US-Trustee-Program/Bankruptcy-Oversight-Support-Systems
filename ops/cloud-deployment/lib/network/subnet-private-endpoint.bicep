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

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'pep-${stackName}'
  location: location
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
        name: 'privatelink_azurewebsites_${stackName}'
        properties: {
          privateDnsZoneId: dnsZoneId
        }
      }
    ]
  }
}
