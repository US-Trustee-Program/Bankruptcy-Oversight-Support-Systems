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

@description('Webapp application name')
param webappName string

// @description('Flag to determine the deployment of the private endpoint')
// param deployNetwork bool = true

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
var linuxFxVersionMap = {
  node: 'NODE|20'
  php: 'PHP|8.2'
}

@description('Filename for nginx server config and must be placed in public folder. Needed for deploying user-interface code when nginx is used.')
param nginxConfigFilename string = 'nginx.conf'
var appCommandLine = 'rm /etc/nginx/sites-enabled/default;envsubst < /home/site/wwwroot/${nginxConfigFilename} > /etc/nginx/sites-enabled/default;service nginx restart'

@description('The prefered minimum TLS Cipher Suite to set for SSL negotiation. NOTE: Azure feature still in preview and limited to Premium plans')
param preferedMinTLSCipherSuite string = 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256'

resource serverFarm 'Microsoft.Web/serverfarms@2022-09-01' = {
  location: location
  name: planName
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

@description('Flag to enable Vercode access')
param allowVeracodeScan bool = false

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

@description('Action Group Name for alerts')
param actionGroupName string = ''

@description('Action Group Resource Group Name for alerts')
param actionGroupResourceGroupName string = ''

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

@description('Resource group name of target virtual network')
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

@description('React-Select hash. Used to set Content-Security-Policy')
@secure()
param camsReactSelectHash string

param privateDnsZoneName string = 'privatelink.azurewebsites.net'
param privateDnsZoneResourceGroup string = virtualNetworkResourceGroupName
@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)
module appInsights './lib/app-insights/app-insights.bicep' =
  if (createApplicationInsights) {
    name: '${webappName}-application-insights-module'
    params: {
      location: location
      kind: 'web'
      appInsightsName: 'appi-${webappName}'
      applicationType: 'web'
      workspaceResourceId: analyticsWorkspaceId
    }
  }
module healthAlertRule './lib/monitoring-alerts/metrics-alert-rule.bicep' =
  if (createAlerts) {
    name: '${webappName}-healthcheck-alert-rule-module'
    params: {
      alertName: '${webappName}-health-check-alert'
      appId: webapp.id
      timeAggregation: 'Average'
      operator: 'LessThan'
      targetResourceType: 'Microsoft.Web/sites'
      metricName: 'HealthCheckStatus'
      severity: 2
      threshold: 100
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: actionGroupResourceGroupName
    }
  }
module httpAlertRule './lib/monitoring-alerts/metrics-alert-rule.bicep' =
  if (createAlerts) {
    name: '${webappName}-http-error-alert-rule-module'
    params: {
      alertName: '${webappName}-http-error-alert'
      appId: webapp.id
      timeAggregation: 'Total'
      operator: 'GreaterThanOrEqual'
      targetResourceType: 'Microsoft.Web/sites'
      metricName: 'Http5xx'
      severity: 1
      threshold: 1
      actionGroupName: actionGroupName
      actionGroupResourceGroupName: actionGroupResourceGroupName
    }
  }
module diagnosticSettings './lib/app-insights/diagnostics-settings-webapp.bicep' = {
  name: '${webappName}-diagnostic-settings-module'
  params: {
    webappName: webappName
    workspaceResourceId: analyticsWorkspaceId
  }
  dependsOn: [
    appInsights
    webapp
  ]
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
    virtualNetworkSubnetId: webappSubnetId
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
      name: 'CSP_CAMS_REACT_SELECT_HASH'
      value: camsReactSelectHash
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
          value: appInsights.outputs.connectionString
        }
      ]
    : []
)

var ipSecurityRestrictionsRules = concat(
  [
    {
      ipAddress: 'Any'
      action: 'Deny'
      priority: 2147483647
      name: 'Deny all'
      description: 'Deny all access'
    }
  ],
  allowVeracodeScan
    ? [
        {
          ipAddress: '3.32.105.199/32'
          action: 'Allow'
          priority: 1000
          name: 'Veracode Agent'
          description: 'Allow Veracode DAST Scans'
        }
      ]
    : []
)
resource webappConfig 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: webapp
  name: 'web'
  properties: union(
    {
      appSettings: applicationSettings
      numberOfWorkers: 1
      alwaysOn: true
      http20Enabled: true
      minimumElasticInstanceCount: 0
      publicNetworkAccess: 'Enabled'
      ipSecurityRestrictions: ipSecurityRestrictionsRules
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
      linuxFxVersion: linuxFxVersionMap['${appServiceRuntime}']
      appCommandLine: appCommandLine
    },
    isPremiumPlanType ? { minTlsCipherSuite: preferedMinTLSCipherSuite } : {}
  )
}
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
  }
}
output webappName string = webapp.name
output webappId string = webapp.id
output webappUrl string = webapp.properties.hostNameSslStates[0].name
