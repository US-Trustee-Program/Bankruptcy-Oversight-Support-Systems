param location string = resourceGroup().location

@description('Application service plan name')
param planName string

@description('Plan type to determine plan Sku')
@allowed([
  'P1v2'
  'B2'
])
param planType string = 'P1v2'

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

@description('Flag to enable Vercode access')
param allowVeracodeScan bool = false

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

@description('Action Group ID for alerts')
param actionGroupId string = ''

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false
/*
  Subnet creation in target virtual network
*/
module webappSubnet './subnet/network-subnet.bicep' = {
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
module privateEndpoint './subnet/network-subnet-private-endpoint.bicep' = {
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

module appInsights './app-insights/app-insights.bicep' = if (deployAppInsights) {
  name: '${webappName}-application-insights-module'
  params: {
    location: location
    kind: 'web'
    appInsightsName: 'appi-${webappName}'
    applicationType: 'web'
    workspaceResourceId: analyticsWorkspaceId
  }
}

module healthAlertRule './monitoring-alerts/metrics-alert-rule.bicep' = if (createAlerts && !empty(actionGroupId)) {
  name: '${webappName}-healthcheck-alert-rule-module'
  params: {
    alertName: '${webappName}-health-check-alert'
    appId: webapp.id
    actionGroupId: actionGroupId
    timeAggregation: 'Average'
    operator: 'LessThan'
    targetResourceType: 'Microsoft.Web/sites'
    metricName: 'HealthCheckStatus'
    severity: 2
    threshold: 100

  }
}
module httpAlertRule './monitoring-alerts/metrics-alert-rule.bicep' = if (createAlerts && !empty(actionGroupId)) {
  name: '${webappName}-http-error-alert-rule-module'
  params: {
    alertName: '${webappName}-http-error-alert'
    appId: webapp.id
    actionGroupId: actionGroupId
    timeAggregation: 'Total'
    operator: 'GreaterThanOrEqual'
    targetResourceType: 'Microsoft.Web/sites'
    metricName: 'Http5xx'
    severity: 1
    threshold: 1
  }
}
module diagnosticSettings 'app-insights/diagnostics-settings-webapp.bicep' = {
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
    virtualNetworkSubnetId: webappSubnet.outputs.subnetId
  }
}
var applicationSettings = concat([],
  deployAppInsights ? [
    {
      name: 'WEBSITE_NODE_DEFAULT_VERSION'
      value: '18'
    }
    {
      name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
      value: '~2'
    }
    {
      name: 'XDT_MicrosoftApplicationInsights_NodeJS'
      value: '1'
    }
    {
      name: 'APPlICATIONINSIGHTS_CONNECTION_STRING'
      value: appInsights.outputs.connectionString
    }
  ] : []
)
var ipSecurityRestrictionsRules = concat([ {
      ipAddress: 'Any'
      action: 'Deny'
      priority: 2147483647
      name: 'Deny all'
      description: 'Deny all access'
    } ],
  allowVeracodeScan ? [ {
      ipAddress: '3.32.105.199/32'
      action: 'Allow'
      priority: 1000
      name: 'Veracode Agent'
      description: 'Allow Veracode DAST Scans'
    } ] : [])
resource webappConfig 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: webapp
  name: 'web'
  properties: {
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
  }
}

output webappName string = webapp.name
output webappId string = webapp.id
output webappUrl string = webapp.properties.hostNameSslStates[0].name
