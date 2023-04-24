@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('Application\'s target virtual network name')
param virtualNetworkName string = '${appName}-vnet'

@description('Private DNS Zone name for private link')
param privateDNSZoneName string = 'privatelink.azurewebsites.net'

@description('Optional array of resource ids of virtual network to link to private dns zone')
param linkVnetIds array = []

@description('Webapp subnet name')
param webappSubnetName string = '${virtualNetworkName}-webapp'

@description('Webapp subnet ip ranges')
param webappAddressPrefix string = '10.0.2.0/28'

@description('Webapp private endpoint subnet name')
param webappPrivateEndpointSubnetName string = '${virtualNetworkName}-webapp-pe'

@description('Webapp private endpoint subnet ip ranges')
param webappPrivateEndpointSubnetAddressPrefix string = '10.0.3.0/28'

@description('Backend Azure Functions subnet name')
param backendFunctionsSubnetName string = '${virtualNetworkName}-function-app'

@description('Backend Azure Functions subnet ip ranges')
param backendFunctionsSubnetAddressPrefix string = '10.0.4.0/28'

@description('Backend private endpoint subnet name')
param backendPrivateEndpointSubnetName string = '${virtualNetworkName}-function-pe'

@description('Backend private endpoint subnet ip ranges')
param backendPrivateEndpointSubnetAddressPrefix string = '10.0.5.0/28'

/*
  USTP BOSS Virtual Network
*/
resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' existing = {
  name: virtualNetworkName
}

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
      id: ustpVirtualNetwork.id
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
  USTP BOSS Subnets
  NOTE: Below subnet configuration can be moved to where each services is setup
*/
resource webappSubnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
  parent: ustpVirtualNetwork
  name: webappSubnetName
  properties: {
    addressPrefix: webappAddressPrefix
    privateEndpointNetworkPolicies: 'Enabled'
    delegations: [
      {
        name: 'Microsoft.Web/serverfarms'
        properties: {
          serviceName: 'Microsoft.Web/serverfarms'
        }
      }
    ]
  }
}

resource webappPrivateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
  parent: ustpVirtualNetwork
  name: webappPrivateEndpointSubnetName
  properties: {
    addressPrefix: webappPrivateEndpointSubnetAddressPrefix
    serviceEndpoints: []
    delegations: []
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

resource backendPrivateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
  parent: ustpVirtualNetwork
  name: backendPrivateEndpointSubnetName
  properties: {
    addressPrefix: backendPrivateEndpointSubnetAddressPrefix
    serviceEndpoints: []
    delegations: []
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

resource backendFunctionsSubnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
  parent: ustpVirtualNetwork
  name: backendFunctionsSubnetName
  properties: {
    addressPrefix: backendFunctionsSubnetAddressPrefix
    serviceEndpoints: [
      {
        service: 'Microsoft.Sql'
        locations: [
          location
        ]
      }
    ]
    delegations: [
      {
        name: 'Microsoft.Web/serverfarms'
        properties: {
          serviceName: 'Microsoft.Web/serverfarms'
        }
      }
    ]
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

/*
  Bicep outputs
*/
output outVnetId string = ustpVirtualNetwork.id
output outWebappSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, webappSubnetName)
output outWebappPrivateEndpointSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, webappPrivateEndpointSubnetName)
output outBackendFuncSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, backendFunctionsSubnetName)
output outBackendFuncPrivateEndpointSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, backendPrivateEndpointSubnetName)
