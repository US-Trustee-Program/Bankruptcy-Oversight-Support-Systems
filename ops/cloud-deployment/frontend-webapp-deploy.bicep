param location string = resourceGroup().location

@description('Application service plan name')
param planName string

@description('Plan type to determine plan Sku')
@allowed([
  'production'
  'development'
])
param planType string = 'development'

var planTypeToSkuMap = {
  production: {
    name: 'P1v2'
    tier: 'PremiumV2'
    size: 'P1v2'
    family: 'Pv2'
    capacity: 1
  }
  development: {
    name: 'B2'
    tier: 'Basic'
    size: 'B2'
    family: 'B'
    capacity: 1
  }
}

@description('Webapp application name')
param webappName string

@description('Private DNS Zone used for application')
param privateDnsZoneName string

@description('Existing virtual network name')
param virtualNetworkName string

@description('Resource group name of target virtual network')
param virtualNetworkResourceGroupName string

@description('Webapp subnet name')
param webappSubnetName string

@description('Webapp subnet ip ranges')
param webappSubnetAddressPrefix string

@description('Webapp private endpoint subnet name')
param webappPrivateEndpointSubnetName string

@description('Webapp private endpoint subnet ip ranges')
param webappPrivateEndpointSubnetAddressPrefix string

resource serverFarm 'Microsoft.Web/serverfarms@2022-09-01' = {
  location: location
  name: planName
  sku: planTypeToSkuMap[planType]
  kind: 'app'
  properties: {
    perSiteScaling: false
    elasticScaleEnabled: false
    maximumElasticWorkerCount: 1
    isSpot: false
    reserved: false // set true for Linux
    isXenon: false
    hyperV: false
    targetWorkerCount: 0
    targetWorkerSizeId: 0
    zoneRedundant: false
  }
}

/*
  Subnet creation in target virtual network
*/
module webappSubnet './network-subnet-deploy.bicep' = {
  name: '${webappName}-subnet-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    virtualNetworkName: virtualNetworkName
    subnetName: webappSubnetName
    subnetAddressPrefix: webappSubnetAddressPrefix
    subnetServiceEndpoints: []
    subnetDelegations: [
      {
        name: 'Microsoft.Web/serverfarms'
        properties: {
          serviceName: 'Microsoft.Web/serverfarms'
        }
      }
    ]
  }
}

/*
  Private endpoint creation in target virtual network.
*/
module privateEndpoint './network-subnet-pep-deploy.bicep' = {
  name: '${webappName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    stackName: webappName
    location: location
    virtualNetworkName: virtualNetworkName
    privateDnsZoneName: privateDnsZoneName
    privateEndpointSubnetName: webappPrivateEndpointSubnetName
    privateEndpointSubnetAddressPrefix: webappPrivateEndpointSubnetAddressPrefix
    privateLinkServiceId: webapp.id
  }
}

/*
  Create webapp
*/
resource webapp 'Microsoft.Web/sites@2022-03-01' = {
  name: webappName
  location: location
  kind: 'app'
  properties: {
    serverFarmId: serverFarm.id
    enabled: true
    httpsOnly: true
    virtualNetworkSubnetId: webappSubnet.outputs.subnetId
  }
}

resource webappConfig 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: webapp
  name: 'web'
  properties: {
    numberOfWorkers: 1
    alwaysOn: true
    http20Enabled: true
    minimumElasticInstanceCount: 0
    publicNetworkAccess: 'Enabled'
    ipSecurityRestrictions: [
      {
        ipAddress: 'Any'
        action: 'Deny'
        priority: 2147483647
        name: 'Deny all'
        description: 'Deny all access'
      }
    ]
    ipSecurityRestrictionsDefaultAction: 'Deny'
    scmIpSecurityRestrictions: [
      {
        ipAddress: 'Any'
        action: 'Deny'
        priority: 2147483647
        name: 'Deny all'
        description: 'Deny all access'
      }
    ]
    scmIpSecurityRestrictionsDefaultAction: 'Deny'
    scmIpSecurityRestrictionsUseMain: false
    defaultDocuments: [
      'index.html'
    ]
    httpLoggingEnabled: true
    logsDirectorySizeLimit: 100
    use32BitWorkerProcess: true
    managedPipelineMode: 'Integrated'
    virtualApplications: [
      {
        virtualPath: '/'
        physicalPath: 'site\\wwwroot'
        preloadEnabled: true
      }
    ]
  }
}

output webappName string = webapp.name
output webappId string = webapp.id
output webappUrl string = webapp.properties.hostNameSslStates[0].name
