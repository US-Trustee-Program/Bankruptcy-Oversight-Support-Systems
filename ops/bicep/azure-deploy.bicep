@description('Sets an application name')
param appName string

@description('Managed Identity name with access Azure KeyVault')
@secure()
param serviceAccountManagedId string

@description('Location for self-signed TLS certificate stored in KeyVault')
@secure()
param apiAgwSSLCertId string

@description('Static ip address for application gateway')
@secure()
param apiAgwPublicIpAddress string

param location string = resourceGroup().location

resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
  sku: {
    name: 'P1v2'
    tier: 'PremiumV2'
    size: 'P1v2'
    family: 'Pv2'
    capacity: 1
  }
  kind: 'app'
  properties: {
    perSiteScaling: false
    elasticScaleEnabled: false
    maximumElasticWorkerCount: 1
    isSpot: false
    reserved: false // set base os to Linux
    isXenon: false
    hyperV: false
    targetWorkerCount: 0
    targetWorkerSizeId: 0
    zoneRedundant: false
  }
}

resource webApplication 'Microsoft.Web/sites@2022-03-01' = {
  name: appName
  location: location
  tags: {
    acms: 'dev'
  }
  kind: 'app'
  properties: {
    enabled: true
    hostNameSslStates: [
      {
        name: '${appName}.azurewebsites.net'
        sslState: 'Disabled'
        hostType: 'Standard'
      }
      {
        name: '${appName}.scm.azurewebsites.net'
        sslState: 'Disabled'
        hostType: 'Repository'
      }
    ]
    serverFarmId: serverFarm.id
    reserved: false
    siteConfig: {
      numberOfWorkers: 1
      acrUseManagedIdentityCreds: false
      alwaysOn: true
      http20Enabled: true
      functionAppScaleLimit: 0
      minimumElasticInstanceCount: 0
    }
    clientAffinityEnabled: false
    httpsOnly: true
  }
  dependsOn: []
}

resource webApplicationConfig 'Microsoft.Web/sites/config@2022-03-01' = {
  parent: webApplication
  name: 'web'
  properties: {
    numberOfWorkers: 1
    defaultDocuments: [
      'Default.htm'
      'Default.html'
      'Default.asp'
      'index.htm'
      'index.html'
      'iisstart.htm'
      'default.aspx'
      'index.php'
      'hostingstart.html'
    ]
    netFrameworkVersion: 'v4.0'
    phpVersion: '5.6'
    requestTracingEnabled: false
    remoteDebuggingEnabled: false
    httpLoggingEnabled: true
    acrUseManagedIdentityCreds: false
    logsDirectorySizeLimit: 100
    detailedErrorLoggingEnabled: false
    scmType: 'None'
    use32BitWorkerProcess: true
    webSocketsEnabled: false
    alwaysOn: true
    managedPipelineMode: 'Integrated'
    virtualApplications: [
      {
        virtualPath: '/'
        physicalPath: 'site\\wwwroot'
        preloadEnabled: true
      }
    ]
    loadBalancing: 'LeastRequests'
    experiments: {
      rampUpRules: []
    }
    autoHealEnabled: false
    vnetRouteAllEnabled: false
    vnetPrivatePortsCount: 0
    localMySqlEnabled: false
    ipSecurityRestrictions: [
      {
        ipAddress: 'Any'
        action: 'Allow'
        priority: 2147483647
        name: 'Allow all'
        description: 'Allow all access'
      }
    ]
    scmIpSecurityRestrictions: [
      {
        ipAddress: 'Any'
        action: 'Allow'
        priority: 2147483647
        name: 'Allow all'
        description: 'Allow all access'
      }
    ]
    scmIpSecurityRestrictionsUseMain: false
    http20Enabled: true
    minTlsVersion: '1.2'
    scmMinTlsVersion: '1.2'
    ftpsState: 'AllAllowed'
    preWarmedInstanceCount: 0
    functionsRuntimeScaleMonitoringEnabled: false
    minimumElasticInstanceCount: 0
    azureStorageAccounts: {
    }
  }
}

var virtualNetworkName = '${appName}-vnet'
var virtualNetworkAddressPrefixes = [ '10.0.0.0/16' ]
resource ustpVirtualNetwork 'Microsoft.Network/virtualNetworks@2022-09-01' = {
  name: virtualNetworkName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: virtualNetworkAddressPrefixes
    }
    enableDdosProtection: false
  }
}

var apiAgwSubnetName = '${appName}-vnet-api-agw'
var apiAgwSubnetAddressPrefix = '10.0.0.0/28'
resource ustpSubnetApiAgw 'Microsoft.Network/virtualNetworks/subnets@2021-03-01' = {
  parent: ustpVirtualNetwork
  name: apiAgwSubnetName
  properties: {
    addressPrefix: apiAgwSubnetAddressPrefix
  }
}

var apiBackendSubnetName = '${appName}-vnet-api-backend'
var apiBackendAddressPrefix = '10.0.1.0/28'
resource ustpSubnetApiBackend 'Microsoft.Network/virtualNetworks/subnets@2021-03-01' = {
  parent: ustpVirtualNetwork
  name: apiBackendSubnetName
  properties: {
    addressPrefix: apiBackendAddressPrefix
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
        properties: {
          serviceName: 'Microsoft.ContainerInstance/containerGroups'
        }
        type: 'Microsoft.Network/virtualNetworks/subnets/delegations'
      }
    ]
  }
}

// NOTE: **ustpApiAgwPublicIP** will not be needed when it is time to set this gateway with a private ip
var apiAgwPublicIP = '${appName}-api-agw-public-ip'
resource ustpApiAgwPublicIP 'Microsoft.Network/publicIPAddresses@2022-09-01' = {
  name: apiAgwPublicIP
  location: location
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  properties: {
    ipAddress: apiAgwPublicIpAddress
    publicIPAddressVersion: 'IPv4'
    publicIPAllocationMethod: 'Static'
    idleTimeoutInMinutes: 4
    ipTags: []
  }
}

var apiAgwName = '${appName}-api-agw'
var apiAgwHttpsListenerName = '${apiAgwName}-https-listener'
var apiAgwHttpsCertName = '${apiAgwName}-https-cert'
var apiAgwHttpsBackendSettingsName = '${apiAgwName}-https-backend-settings'
var apiAgwHttpsBackendTargetsName = '${apiAgwName}-https-backend-targets'
var apiAgwHttpsRoutingRuleName = '${apiAgwName}-https-routing-rule'

var agwAssignedIdentity = '${subscription().id}/resourcegroups/${resourceGroup().name}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/${serviceAccountManagedId}'

resource ustpAPIApplicationGateway 'Microsoft.Network/applicationGateways@2022-09-01' = {
  name: apiAgwName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${agwAssignedIdentity}': {
      }
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
            id: ustpSubnetApiAgw.id
          }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'agwPublicFrontendIpIPv4'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: ustpApiAgwPublicIP.id
          }
        }
      }
    ]
    sslCertificates: [
      {
        name: apiAgwHttpsCertName
        properties: {
          keyVaultSecretId: apiAgwSSLCertId
        }
      }
    ]
    trustedRootCertificates: []
    trustedClientCertificates: []
    sslProfiles: []
    frontendPorts: [
      {
        name: 'port_443'
        properties: {
          port: 443
        }
      }
    ]
    backendAddressPools: [
      {
        name: apiAgwHttpsBackendTargetsName
        properties: {
          backendAddresses: [ {
              ipAddress: '10.0.1.4'
            }, {
              ipAddress: '10.0.1.5'
            }, {
              ipAddress: '10.0.1.6'
            }, {
              ipAddress: '10.0.1.7'
            }, {
              ipAddress: '10.0.1.8'
            }, {
              ipAddress: '10.0.1.9'
            }, {
              ipAddress: '10.0.1.10'
            }, {
              ipAddress: '10.0.1.11'
            }, {
              ipAddress: '10.0.1.12'
            }, {
              ipAddress: '10.0.1.13'
            }, {
              ipAddress: '10.0.1.14'
            } ]
        }
      }
    ]
    loadDistributionPolicies: []
    backendHttpSettingsCollection: [
      {
        name: apiAgwHttpsBackendSettingsName
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
        name: apiAgwHttpsListenerName
        properties: {
          frontendIPConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', apiAgwName, 'agwPublicFrontendIpIPv4')
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', apiAgwName, 'port_443')
          }
          protocol: 'Https'
          sslCertificate: {
            id: resourceId('Microsoft.Network/applicationGateways/sslCertificates', apiAgwName, apiAgwHttpsCertName)
          }
        }
      }
    ]
    listeners: []
    urlPathMaps: []
    requestRoutingRules: [
      {
        name: apiAgwHttpsRoutingRuleName
        properties: {
          ruleType: 'Basic'
          priority: 1
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', apiAgwName, apiAgwHttpsListenerName)
          }
          backendAddressPool: {
            id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', apiAgwName, apiAgwHttpsBackendTargetsName)
          }
          backendHttpSettings: {
            id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', apiAgwName, apiAgwHttpsBackendSettingsName)
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
