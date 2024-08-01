param location string = resourceGroup().location

@description('Application service plan name')
param planName string


param webappName string

@description('Url for our Okta Provider')
param oktaUrl string = ''

@description('Filename for nginx server config and must be placed in public folder. Needed for deploying user-interface code when nginx is used.')
param nginxConfigFilename string = 'nginx.conf'

var appCommandLine = 'rm /etc/nginx/sites-enabled/default;envsubst < /home/site/wwwroot/${nginxConfigFilename} > /etc/nginx/sites-enabled/default;service nginx restart'

@description('The prefered minimum TLS Cipher Suite to set for SSL negotiation. NOTE: Azure feature still in preview and limited to Premium plans')
param preferedMinTLSCipherSuite string = 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256'

@description('Flag to enable Vercode access')
param allowVeracodeScan bool = false

@description('boolean to determine creation and configuration of Application Insights for the Azure Function')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

@description('Webapp subnet resource ID')
param webappSubnetId string

@description('Target backend API server host. Used to set Content-Security-Policy')
param targetApiServerHost string

@description('Optional. USTP Issue Collector hash. Used to set Content-Security-Policy')
@secure()
param ustpIssueCollectorHash string = ''

@description('React-Select hash. Used to set Content-Security-Policy')
@secure()
param camsReactSelectHash string

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: 'appi-${webappName}'
  scope: resourceGroup()
}

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

resource serverFarm 'Microsoft.Web/serverfarms@2022-09-01' existing =  {
  name: planName
  scope: resourceGroup()
}

resource webapp 'Microsoft.Web/sites@2022-03-01' existing = {
  name: webappName
  scope: resourceGroup()
}

resource webappSlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: webapp
  name: 'staging'
  location: 'USGov Virginia'
  kind: 'app,linux'
  properties: {
    enabled: true
    serverFarmId: serverFarm.id
    vnetRouteAllEnabled: true
    siteConfig: {
      numberOfWorkers: 1
      linuxFxVersion: 'PHP|8.2'
      acrUseManagedIdentityCreds: false
      alwaysOn: true
      http20Enabled: true
      functionAppScaleLimit: 0
      minimumElasticInstanceCount: 1
    }
    clientAffinityEnabled: true
    httpsOnly: false
    publicNetworkAccess: 'Enabled'
    virtualNetworkSubnetId: webappSubnetId
    keyVaultReferenceIdentity: 'SystemAssigned'
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
          value: appInsights.properties.ConnectionString
        }
      ]
    : []
)

resource sites_ustp_cams_webapp_name_staging_web 'Microsoft.Web/sites/slots/config@2023-12-01' = {
  parent: webappSlot
  name: 'web'
  properties: {
    appSettings: applicationSettings
    numberOfWorkers: 1
    defaultDocuments: [
      'index.html'
    ]
    linuxFxVersion: 'PHP|8.2'
    httpLoggingEnabled: true
    logsDirectorySizeLimit: 100
    detailedErrorLoggingEnabled: true
    use32BitWorkerProcess: true
    alwaysOn: true
    appCommandLine: appCommandLine
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
      rampUpRules: [
        {
          actionHostName: 'ustp-cams-webapp-staging.azurewebsites.us'
          reroutePercentage: 0
          name: 'staging'
        }
      ]
    }
    autoHealEnabled: false
    vnetRouteAllEnabled: true
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
    http20Enabled: true
    preWarmedInstanceCount: 0
    elasticWebAppScaleLimit: 0
    minimumElasticInstanceCount: 1
  }
}
