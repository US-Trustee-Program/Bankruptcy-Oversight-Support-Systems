@description('Sets an application name')
param appName string

param location string = resourceGroup().location
param readerGuid string

@secure()
param agwPrivateIP string

var keyVaultManagedIdentityName = '${appName}-mi-keyvault'
resource ustpKeyVaultManagedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: keyVaultManagedIdentityName
  location: location
}

var keyVaultName = '${appName}-kv'
resource ustpKeyVault 'Microsoft.KeyVault/vaults@2022-11-01' = {
  name: keyVaultName
  location: location
  properties: {
    accessPolicies: []
    publicNetworkAccess: 'Disabled'
    enableRbacAuthorization: false
    tenantId: tenant().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

//@description('Store base 64 encoded .pfx and pass as secret')
// var certDataName = '${appName}-tlsCertData'
// resource ustpApiTlsCertData 'Microsoft.KeyVault/vaults/secrets@2022-11-01' = {
//   parent: ustpKeyVault
//   name: certDataName
//   properties: {
//     value: apiCertData
//     contentType: 'application/x-pkcs12'
//     attributes: {
//       enabled: true
//     }
//   }
// }
// var certPassName = '${appName}-tlsCertPass'
// resource ustpApiTlsCertPass 'Microsoft.KeyVault/vaults/secrets@2022-11-01' = {
//   parent: ustpKeyVault
//   name: certPassName
//   properties: {
//     value: apiCertPass
//     attributes: {
//       enabled: true
//     }
//   }
// }

// @description('This is the built-in Key Vault Administrator role. See https://docs.microsoft.com/azure/role-based-access-control/built-in-roles#key-vault-administrator')
// resource keyVaultAdministratorRoleDefinition 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
//   scope: subscription()
//   name: '00482a5a-887f-4fb3-b363-3b7fe8e74483'
// }
@description('This is the built-in Key Vault Reader role.')
resource keyVaultReaderRoleDefinition 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: readerGuid
}

var keyVaultRoleAssignmentGuid = guid(ustpKeyVault.id, ustpKeyVaultManagedIdentity.id, keyVaultReaderRoleDefinition.id)
resource ustpKeyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: keyVaultRoleAssignmentGuid
  scope: ustpKeyVault
  properties: {
    roleDefinitionId: keyVaultReaderRoleDefinition.id
    principalId: ustpKeyVaultManagedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

var virtualNetworkName = '${appName}-vnet'
var virtualNetworkAddressPrefixes = [ '10.0.0.0/16' ]
var apiAgwSubnetName = '${appName}-vnet-api-agw'
var apiAgwSubnetAddressPrefix = '10.0.0.0/28'
var apiBackendSubnetName = '${appName}-vnet-api-backend'
var apiBackendAddressPrefix = '10.0.1.0/28'
var webappSubnetName = '${appName}-vnet-webapp'
var webappAddressPrefix = '10.0.2.0/28'
resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' = {
  name: virtualNetworkName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: virtualNetworkAddressPrefixes
    }
    enableDdosProtection: false
    subnets: [
      {
        name: apiAgwSubnetName
        properties: {
          addressPrefix: apiAgwSubnetAddressPrefix
          privateEndpointNetworkPolicies: 'Enabled'
        }
      }
      {
        name: apiBackendSubnetName
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
      {
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
    ]
  }
}
output outVnetId string = ustpVirtualNetwork.id
output outAgwSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, apiAgwSubnetName)
output outBackendSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, apiBackendSubnetName)
output outWebappSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, webappSubnetName)

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
