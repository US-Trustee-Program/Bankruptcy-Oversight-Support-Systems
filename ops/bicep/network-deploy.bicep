@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('Application\'s target virtual network name')
param virtualNetworkName string = '${appName}-vnet'

@description('API application gateway subnet name')
param apiAgwSubnetName string = '${virtualNetworkName}-api-agw'

@description('API application gateway subnet ip ranges')
param apiAgwSubnetAddressPrefix string = '10.0.0.0/28'

@description('API backend subnet name')
param apiBackendSubnetName string = '${virtualNetworkName}-api-backend'

@description('API backend instance subnet ip ranges')
param apiBackendAddressPrefix string = '10.0.1.0/28'

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
  USTP BOSS Subnets
*/
resource apiAppGatewaySubnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
  name: apiAgwSubnetName
  parent: ustpVirtualNetwork
  properties: {
    addressPrefix: apiAgwSubnetAddressPrefix
    privateEndpointNetworkPolicies: 'Enabled'
  }
}

resource apiBackendSubnet 'Microsoft.Network/virtualNetworks/subnets@2022-07-01' = {
  name: apiBackendSubnetName
  parent: ustpVirtualNetwork
  properties: {
    addressPrefix: apiBackendAddressPrefix
    privateEndpointNetworkPolicies: 'Enabled'
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
        name: 'Microsoft.ContainerInstance.containerGroups'
        properties: {
          serviceName: 'Microsoft.ContainerInstance/containerGroups'
        }
      }
    ]
  }
}

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
output outAgwSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, apiAgwSubnetName)
output outBackendSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, apiBackendSubnetName)
output outWebappSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, webappSubnetName)
output outWebappPrivateEndpointSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, webappPrivateEndpointSubnetName)
output outBackendFuncSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, backendFunctionsSubnetName)
output outBackendFuncPrivateEndpointSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, backendPrivateEndpointSubnetName)
