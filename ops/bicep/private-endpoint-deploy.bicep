@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('Private DNS Zone name for private link')
param privateDNSZoneName string = 'privatelink.azurewebsites.net'

@description('Target virtual network resource id for private DNS zone')
param virtualNetworkId string

@description('Optional array of resource ids of virtual network to link to private dns zone')
param linkVnetIds array = []

@description('Target subnet resource id for webapp private endpoint')
param webappPrivateEndpointSubnetId string

@description('Web Application resource id')
param webApplicationId string

@description('Target subnet resource id for backend functionapp private endpoint')
param functionsPrivateEndpointSubnetId string

@description('Backend functionapp resource id')
param functionsAppId string

/*
  Private DNS Zone and linked virtual networks
*/
resource ustpPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: privateDNSZoneName
  location: 'global'
  tags: {
    appName: appName
  }
}

resource ustpPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
  name: '${privateDNSZoneName}-vnet-link'
}

// optional step to include additional link to existing PrivateDnsZone
resource ustpAdditionalVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [for vnetId in linkVnetIds: {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
  name: 'ustp-${uniqueString(resourceGroup().id, vnetId)}-vnet-link'
}]

/*
  Webapp private endpoint setup
*/
var webappPrivateEndpointName = '${appName}-webapp-private-endpoint'
var webappPrivateEndpointConnectionName = '${appName}-webapp-private-endpoint-connection'
resource ustpWebappPrivateEndpoint 'Microsoft.Network/privateEndpoints@2022-09-01' = {
  name: webappPrivateEndpointName
  location: location
  properties: {
    privateLinkServiceConnections: [
      {
        name: webappPrivateEndpointConnectionName
        properties: {
          privateLinkServiceId: webApplicationId
          groupIds: [
            'sites'
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
      id: webappPrivateEndpointSubnetId
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
  dependsOn: [
    ustpPrivateDnsZone
  ]
}

resource ustpWebappPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2022-09-01' = {
  parent: ustpWebappPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink_azurewebsites'
        properties: {
          privateDnsZoneId: ustpPrivateDnsZone.id
        }
      }
    ]
  }
}

/*
  Backend functionapp private endpoint setup
*/
var functionsPrivateEndpointName = '${appName}-function-app-private-endpoint'
var functionsPrivateEndpointConnectionName = '${appName}-function-app-private-endpoint-connection'
resource ustpFunctionsPrivateEndpoint 'Microsoft.Network/privateEndpoints@2022-09-01' = {
  name: functionsPrivateEndpointName
  location: location
  properties: {
    privateLinkServiceConnections: [
      {
        name: functionsPrivateEndpointConnectionName
        properties: {
          privateLinkServiceId: functionsAppId
          groupIds: [
            'sites'
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
      id: functionsPrivateEndpointSubnetId
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
  dependsOn: [
    ustpPrivateDnsZone
  ]
}

resource ustpFunctionsPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2022-09-01' = {
  parent: ustpFunctionsPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink_azurewebsites'
        properties: {
          privateDnsZoneId: ustpPrivateDnsZone.id
        }
      }
    ]
  }
}
