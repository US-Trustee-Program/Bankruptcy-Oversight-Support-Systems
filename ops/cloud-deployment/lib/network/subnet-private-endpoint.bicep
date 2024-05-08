@description('Provide a name used for labeling related resources')
param stackName string

param location string = resourceGroup().location
@description('Resource id of existing service to be linked')
param privateLinkServiceId string
@description('Group for private link service')
@allowed([
  'sites'
  'vault'
])
param privateLinkGroup string
param privateEndpointSubnetId string

// param virtualNetworkName string
// param privateEndpointSubnetAddressPrefix string
// param privateDnsZoneName string
// param privateDnsZoneResourceGroup string = resourceGroup().name
// param privateDnsZoneSubscriptionId string = subscription().subscriptionId
// param privatDnsZoneId string = ''

/*
  Create subnet for private endpoint
*/

/*
  Create private endpoint ****need to move this elsewhere
// */
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-02-01' = {
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

// var dnsZoneId = empty(privateDnsZone.id) ? privateDnsZone.id : privatDnsZoneId
// resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-02-01' = {
//   parent: privateEndpoint
//   name: 'default'
//   properties: {
//     privateDnsZoneConfigs: [
//       {
//         name: 'privatelink_azurewebsites_${stackName}'
//         properties: {
//           privateDnsZoneId: dnsZoneId
//         }
//       }
//     ]
//   }
// }
/*
  Add private dns zone group to private endpoint
*/
