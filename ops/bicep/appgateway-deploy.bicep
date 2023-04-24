@description('Sets an application name')
param appName string

param location string = resourceGroup().location

@description('API Application Gateway Name')
param apiAgwName string = '${appName}-api-agw'

@description('Target subnet resource id to deploy application gateway')
param apiAgwSubnetId string

@description('API application gateway private Ip')
param agwPrivateIP string = '10.0.0.8'

@description('API Application Gateway Public IP Name')
param apiAgwPublicIp string = '${appName}-api-agw-public-ip'

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

var apiAgwHttpListenerName = '${apiAgwName}-http-listener'
var apiAgwHttpBackendSettingsName = '${apiAgwName}-http-backend-settings'
var apiAgwBackendTargetsName = '${apiAgwName}-https-backend-targets'
var apiAgwHttpRoutingRuleName = '${apiAgwName}-http-routing-rule'

resource ustpAPIApplicationGateway 'Microsoft.Network/applicationGateways@2022-09-01' = {
  name: apiAgwName
  location: location
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
            id: apiAgwSubnetId
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
            id: apiAgwSubnetId
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
    sslCertificates: []
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
}
