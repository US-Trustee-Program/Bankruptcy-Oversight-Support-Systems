param location string = resourceGroup().location

@description('Application service plan name')
param planName string

@description('Plan type to determine plan Sku')
@allowed([
  'P1v2'
  'B2'
  'S1'
])
param planType string = 'P1v2'

var premiumPlans = ['P1v2']
var isPremiumPlanType = contains(premiumPlans, planType)
var planTypeToSkuMap = {
  P1v2: {
    name: 'P1v2'
    tier: 'PremiumV2'
    size: 'P1v2'
    family: 'Pv2'
    capacity: 1
  }
  B2: {
    name: 'B2'
    tier: 'Basic'
    size: 'B2'
    family: 'B'
    capacity: 1
  }
  S1: {
    name: 'S1'
    tier: 'Standard'
    size: 'S1'
    family: 'S'
    capacity: 1
  }
}

param webappName string
param slotName string

@description('Determine host instance operating system type. false for Windows OS and true for Linux OS.')
param hostOSType bool = true

@description('Azure App Service runtime environment. Only applicable when host os type is Linux.')
@allowed([
  'node'
  'php'
])
param appServiceRuntime string = 'php'
// Provides mapping for runtime stack
// Use the following query to check supported versions
//  az functionapp list-runtimes --os linux --query "[].{stack:join(' ', [runtime, version]), LinuxFxVersion:linux_fx_version, SupportedFunctionsVersions:to_string(supported_functions_versions[])}" --output table
// NOTE: Node version should match major version in .nvmrc (currently v22.x.x)
var linuxFxVersionMap = {
  node: 'NODE|22'
  php: 'PHP|8.2'
}

@description('Url for our Okta Provider')
param oktaUrl string = ''

@description('Filename for nginx server config and must be placed in public folder. Needed for deploying user-interface code when nginx is used.')
param nginxConfigFilename string = 'nginx.conf'
var appCommandLine = 'rm /etc/nginx/sites-enabled/default;envsubst < /home/site/wwwroot/${nginxConfigFilename} > /etc/nginx/sites-enabled/default;service nginx restart'

@description('The preferred minimum TLS Cipher Suite to set for SSL negotiation. NOTE: Azure feature still in preview and limited to Premium plans')
param preferredMinTLSCipherSuite string = 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256'

@description('Is ustp deployment')
param isUstpDeployment bool

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

@description('Action Group Name for alerts')
param actionGroupName string = ''

param actionGroupResourceGroupName string = ''

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

param virtualNetworkResourceGroupName string

@description('Webapp subnet resource ID')
param webappSubnetId string

@description('Private Endpoint Subnet resource ID')
param privateEndpointSubnetId string

@description('Target backend API server host. Used to set Content-Security-Policy')
param targetApiServerHost string

@description('Optional. USTP Issue Collector hash. Used to set Content-Security-Policy')
@secure()
param ustpIssueCollectorHash string = ''

param privateDnsZoneName string = 'privatelink.azurewebsites.us'

param privateDnsZoneResourceGroup string = virtualNetworkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

param tags object = {}

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)

resource serverFarm 'Microsoft.Web/serverfarms@2022-09-01' = {
  location: location
  name: planName
  tags: tags
  sku: planTypeToSkuMap[planType]
  kind: 'app,linux'
  properties: {
    perSiteScaling: false
    elasticScaleEnabled: false
    maximumElasticWorkerCount: 1
    isSpot: false
    reserved: hostOSType
    isXenon: false
    hyperV: false
    targetWorkerCount: 0
    targetWorkerSizeId: 0
    zoneRedundant: false
  }
}

/*
  Create webapp
*/
resource webapp 'Microsoft.Web/sites@2023-12-01' = {
  name: webappName
  location: location
  tags: tags
  kind: 'app'
  properties: {
    serverFarmId: serverFarm.id
    enabled: true
    httpsOnly: true
    virtualNetworkSubnetId: webappSubnetId
  }

  resource webappConfig 'config' = {
    name: 'web'
    properties: productionWebappConfigProperties
  }

  resource slot 'slots' = {
      location: location
      name: slotName
      tags: union(tags, { slot: 'deployment' })
      properties: {
        serverFarmId: webapp.properties.serverFarmId
        enabled: webapp.properties.enabled
        httpsOnly: webapp.properties.httpsOnly
        virtualNetworkSubnetId: webapp.properties.virtualNetworkSubnetId
      }
      resource slotWebAppConfig 'config' = {
        name: 'web'
        properties: stagingWebappConfigProperties
      }
  }
}

module webappInsights 'lib/app-insights/webapp-insights.bicep' = {
  name: '${webappName}-appi-settings-module'
  params: {
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
    analyticsWorkspaceId: analyticsWorkspaceId
    createAlerts: createAlerts
    createApplicationInsights: createApplicationInsights
    webappName: webappName
    tags: tags
  }
  dependsOn: [
    webapp
  ]
}

module searchWorkbooks 'lib/workbooks/search-workbooks.bicep' = if (createApplicationInsights) {
  name: '${webappName}-search-workbooks-module'
  params: {
    location: location
    appInsightsResourceId: webappInsights.outputs.id
    tags: tags
  }
}

var applicationSettings = concat(
  [
    {
      name: 'CSP_API_SERVER_HOST'
      value: targetApiServerHost
    }
    {
      name: 'CSP_USTP_ISSUE_COLLECTOR_HASH'
      value: ustpIssueCollectorHash
    }
    {
      name: 'OKTA_URL'
      value: oktaUrl
    }
    {
      name: 'NGINX_URI_VAR_VALUE' // workaround to prevent $uri from getting subsituted when invoking envsubst
      value: '$uri'
    }
  ],
  createApplicationInsights
    ? [
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~2'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: webappInsights.outputs.connectionString
        }
      ]
    : []
)

var productionIpSecurityRestrictionsRules = isUstpDeployment
  ? [
      {
        ipAddress: 'Any'
        action: 'Deny'
        priority: 2147483647
        name: 'Deny all'
        description: 'Deny all access'
      }
    ]
  : []

var stagingIpSecurityRestrictionsRules = [
  {
    ipAddress: 'Any'
    action: 'Deny'
    priority: 2147483647
    name: 'Deny all'
    description: 'Deny all access'
  }
]

var baseWebappConfigProperties = {
  appSettings: applicationSettings
  numberOfWorkers: 1
  alwaysOn: true
  http20Enabled: true
  minimumElasticInstanceCount: 0
  publicNetworkAccess: 'Enabled'
  ipSecurityRestrictionsDefaultAction: isUstpDeployment ? 'Deny' : 'Allow'
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
  linuxFxVersion: linuxFxVersionMap['${appServiceRuntime}']
  appCommandLine: appCommandLine
}

var productionWebappConfigProperties = union(
  baseWebappConfigProperties,
  {
    ipSecurityRestrictions: productionIpSecurityRestrictionsRules
  },
  isPremiumPlanType ? { minTlsCipherSuite: preferredMinTLSCipherSuite } : {}
)

var stagingWebappConfigProperties = union(
  baseWebappConfigProperties,
  {
    ipSecurityRestrictions: stagingIpSecurityRestrictionsRules
    ipSecurityRestrictionsDefaultAction: 'Deny'
  },
  isPremiumPlanType ? { minTlsCipherSuite: preferredMinTLSCipherSuite } : {}
)

module privateEndpoint './lib/network/subnet-private-endpoint.bicep' = {
  name: '${webappName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites'
    stackName: webappName
    location: location
    privateLinkServiceId: webapp.id
    privateEndpointSubnetId: privateEndpointSubnetId
    privateDnsZoneName: privateDnsZoneName
    privateDnsZoneResourceGroup: privateDnsZoneResourceGroup
    privateDnsZoneSubscriptionId: privateDnsZoneSubscriptionId
    tags: tags
  }
}
