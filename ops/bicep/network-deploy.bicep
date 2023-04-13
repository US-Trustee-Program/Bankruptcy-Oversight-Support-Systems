@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('Application\'s target virtual network name')
param virtualNetworkName string = '${appName}-vnet'

@description('API application gateway subnet name')
param apiAgwSubnetName string = '${virtualNetworkName}-api-agw'

@description('API application gateway subnet ip ranges')
param apiAgwSubnetAddressPrefix string = '10.0.0.0/28'

@description('API application gateway private Ip')
param agwPrivateIP string = '10.0.0.8'

@description('API backend subnet name')
param apiBackendSubnetName string = '${virtualNetworkName}-api-backend'

@description('API backend instance subnet ip ranges')
param apiBackendAddressPrefix string = '10.0.1.0/28'

@description('Webapp subnet name')
param webappSubnetName string = '${virtualNetworkName}-webapp'

@description('Webapp subnet ip ranges')
param webappAddressPrefix string = '10.0.2.0/28'

@description('Webapp private endpoint name')
param webappPrivateEndpointSubnetName string = '${virtualNetworkName}-webapp-pe'

@description('Webapp private endpoint subnet ip ranges')
param webappPrivateEndpointSubnetAddressPrefix string = '10.0.5.0/28'

// look into `what if?`
// consider resource lock for prod
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
  name: webappPrivateEndpointSubnetName
  parent: ustpVirtualNetwork
  properties: {
    addressPrefix: webappPrivateEndpointSubnetAddressPrefix
    serviceEndpoints: []
    delegations: []
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

/*
  Application Gateway
*/
resource ustpKeyVaultManagedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: '${appName}-mi-keyvault'
}
var apiAgwName = '${appName}-api-agw'
// var apiAgwHttpsListenerName = '${apiAgwName}-https-listener'
var apiAgwHttpListenerName = '${apiAgwName}-http-listener'
// var apiAgwHttpsCertName = '${apiAgwName}-https-cert'
var apiAgwHttpBackendSettingsName = '${apiAgwName}-http-backend-settings'
var apiAgwBackendTargetsName = '${apiAgwName}-https-backend-targets'
// var apiAgwHttpsRoutingRuleName = '${apiAgwName}-https-routing-rule'
var apiAgwHttpRoutingRuleName = '${apiAgwName}-http-routing-rule'
var apiAgwPublicIp = '${appName}-api-agw-public-ip'

resource ustpApiAgwPublicIp 'Microsoft.Network/publicIPAddresses@2022-09-01' = {
  name: apiAgwPublicIp
  location: location
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    ddosSettings: {
      protectionMode: 'VirtualNetworkInherited'
    }
  }
}

resource ustpAPIApplicationGateway 'Microsoft.Network/applicationGateways@2022-09-01' = {
  name: apiAgwName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${ustpKeyVaultManagedIdentity.id}': {}
    }
  }
  properties: {
    sku: {
      name: 'Standard_v2'
      tier: 'Standard_v2'
    }
    gatewayIPConfigurations: [
      {
        name: 'agwIpConfig'
        properties: {
          subnet: {
            id: resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, apiAgwSubnetName)
          }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'appGatewayFrontendPrivateIp'
        properties: {
          privateIPAddress: agwPrivateIP
          privateIPAllocationMethod: 'Static'
          subnet: {
            id: resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, apiAgwSubnetName)
          }
        }
      }
      {
        name: 'appGatewayFrontendPublicIp'
        properties: {
          publicIPAddress: {
            id: ustpApiAgwPublicIp.id
          }
        }
      }
    ]
    sslCertificates: [
      // TODO : implementation still work in progress
      // {
      //   name: apiAgwHttpsCertName
      //   properties: {
      //     data: ustpApiTlsCertData.properties.value
      //     password: ustpApiTlsCertPass.properties.value
      //   }
      // }
    ]
    trustedRootCertificates: []
    trustedClientCertificates: []
    sslProfiles: []
    frontendPorts: [
      {
        name: 'port_80'
        properties: {
          port: 80
        }
      }
      {
        name: 'port_443'
        properties: {
          port: 443
        }
      }
    ]
    backendAddressPools: [
      {
        name: apiAgwBackendTargetsName
        properties: {
          backendAddresses: []
        }
      }
    ]
    loadDistributionPolicies: []
    backendHttpSettingsCollection: [
      {
        name: apiAgwHttpBackendSettingsName
        properties: {
          port: 8080
          protocol: 'Http'
          cookieBasedAffinity: 'Disabled'
          pickHostNameFromBackendAddress: false
          affinityCookieName: 'ApplicationGatewayAffinity'
          requestTimeout: 20
        }
      }
    ]
    backendSettingsCollection: []
    httpListeners: [
      // {
      //   name: apiAgwHttpsListenerName
      //   properties: {
      //     frontendIPConfiguration: {
      //       id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', apiAgwName, 'appGatewayFrontendPrivateIp')
      //     }
      //     frontendPort: {
      //       id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', apiAgwName, 'port_443')
      //     }
      //     protocol: 'Https'
      //     sslCertificate: {
      //       id: resourceId('Microsoft.Network/applicationGateways/sslCertificates', apiAgwName, apiAgwHttpsCertName)
      //     }
      //   }
      // }
      {
        name: apiAgwHttpListenerName
        properties: {
          frontendIPConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', apiAgwName, 'appGatewayFrontendPrivateIp')
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', apiAgwName, 'port_80')
          }
          protocol: 'Http'
        }
      }
    ]
    listeners: []
    urlPathMaps: []
    requestRoutingRules: [
      // {
      //   name: apiAgwHttpsRoutingRuleName
      //   properties: {
      //     ruleType: 'Basic'
      //     priority: 100
      //     httpListener: {
      //       id: resourceId('Microsoft.Network/applicationGateways/httpListeners', apiAgwName, apiAgwHttpsListenerName)
      //     }
      //     backendAddressPool: {
      //       id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', apiAgwName, apiAgwBackendTargetsName)
      //     }
      //     backendHttpSettings: {
      //       id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', apiAgwName, apiAgwHttpBackendSettingsName)
      //     }
      //   }
      // }
      {
        name: apiAgwHttpRoutingRuleName
        properties: {
          ruleType: 'Basic'
          priority: 200
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', apiAgwName, apiAgwHttpListenerName)
          }
          backendAddressPool: {
            id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', apiAgwName, apiAgwBackendTargetsName)
          }
          backendHttpSettings: {
            id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', apiAgwName, apiAgwHttpBackendSettingsName)
          }
        }
      }
    ]
    routingRules: []
    probes: []
    rewriteRuleSets: []
    redirectConfigurations: []
    privateLinkConfigurations: []
    enableHttp2: false
    autoscaleConfiguration: {
      minCapacity: 0
      maxCapacity: 2
    }
  }
  dependsOn: [ ustpVirtualNetwork ]
}

/*
  Resolves webapp DNS to a private IP via Private DNS Zone and Private Endpoint Link
*/
resource ustpPrivateDnsZone 'Microsoft.Network/privateDnsZones@2018-09-01' = {
  name: 'privatelink.azurewebsites.net'
  location: 'global'
}

resource ustpPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2018-09-01' = {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: ustpVirtualNetwork.id
    }
  }
  name: 'privatelink.azurewebsites.net-vnet-link'
}

resource webApplication 'Microsoft.Web/sites@2022-03-01' existing = {
  name: appName
}
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
          privateLinkServiceId: webApplication.id
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
      id: webappPrivateEndpointSubnet.id
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
}

resource ustpPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2022-09-01' = {
  parent: ustpWebappPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink_azurewebsites_net'
        properties: {
          privateDnsZoneId: ustpPrivateDnsZone.id
        }
      }
    ]
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
