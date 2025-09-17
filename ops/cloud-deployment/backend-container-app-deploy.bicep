param location string = resourceGroup().location

param stackName string = 'ustp-cams'

param apiContainerAppName string

param containerAppsEnvironmentName string

param containerRegistryName string

param apiContainerSubnetId string

@description('Virtual network resource group name - used for future networking extensions')
param virtualNetworkResourceGroupName string

param mssqlRequestTimeout string

@description('Container image tag/version to deploy')
param containerImageTag string = 'latest'

param loginProviderConfig string

param loginProvider string

@description('Is ustp deployment')
param isUstpDeployment bool

@description('List of origins to allow. Need to include protocol')
param apiCorsAllowOrigins array = []

@description('Resource group name of the app config KeyVault')
param kvAppConfigResourceGroupName string = ''

@description('name of the app config KeyVault')
param kvAppConfigName string = 'kv-${stackName}'

@description('Name of the managed identity with read access to the keyvault storing application configurations.')
@secure()
param idKeyvaultAppConfiguration string

param cosmosDatabaseName string

@description('boolean to determine creation and configuration of Application Insights for the Container App')
param deployAppInsights bool = false

@description('Log Analytics Workspace ID associated with Application Insights')
param analyticsWorkspaceId string = ''

param actionGroupName string = ''

param actionGroupResourceGroupName string = ''

@description('boolean to determine creation and configuration of Alerts')
param createAlerts bool = false

param maxObjectDepth string

param maxObjectKeyCount string

param gitSha string

var createApplicationInsights = deployAppInsights && !empty(analyticsWorkspaceId)

// Reference existing managed identity for app configuration
resource appConfigIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: idKeyvaultAppConfiguration
  scope: resourceGroup(kvAppConfigResourceGroupName)
}

// Deploy Container Registry
module containerRegistry './lib/container/container-registry.bicep' = {
  name: '${containerRegistryName}-module'
  params: {
    name: containerRegistryName
    location: location
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    tags: {
      'Stack Name': stackName
    }
  }
}

// Deploy Container Apps Environment
module containerEnvironment './lib/container/container-apps-environment.bicep' = {
  name: '${containerAppsEnvironmentName}-module'
  params: {
    name: containerAppsEnvironmentName
    location: location
    logAnalyticsWorkspaceId: analyticsWorkspaceId
    // WARNING: Current subnet (10.10.11.0/28) may be too small for Container Apps Environment
    // Container Apps typically need /23 or /24 subnet. Consider expanding subnet or creating dedicated one.
    vnetConfiguration: !empty(apiContainerSubnetId) ? {
      infrastructureSubnetId: apiContainerSubnetId
      internal: false
    } : {}
    tags: {
      'Stack Name': stackName
    }
  }
}

// Create managed identity for container app
resource containerAppIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${apiContainerAppName}'
  location: location
  tags: {
    'Stack Name': stackName
  }
}

// Grant ACR pull access to container app identity
module acrRoleAssignment './lib/identity/role-assignment.bicep' = {
  name: '${apiContainerAppName}-acr-role-module'
  params: {
    roleDefinitionId: '/subscriptions/${subscription().subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
    principalId: containerAppIdentity.properties.principalId
    targetResourceId: containerRegistry.outputs.registryId
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiContainerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${containerAppIdentity.id}': {}
      '${appConfigIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerEnvironment.outputs.environmentId
    configuration: {
      activeRevisionsMode: 'Multiple'
      maxInactiveRevisions: 10
      ingress: {
        external: !empty(apiContainerSubnetId) ? false : true  // Internal if VNet integrated, external otherwise
        targetPort: 80
        transport: 'http'
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
        corsPolicy: {
          allowedOrigins: apiCorsAllowOrigins
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: true
        }
      }
      registries: [
        {
          server: containerRegistry.outputs.loginServer
          identity: containerAppIdentity.id
        }
      ]
      secrets: concat([
        {
          name: 'admin-key'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/ADMIN-KEY'
          identity: appConfigIdentity.id
        }
        {
          name: 'mongo-connection-string'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/MONGO-CONNECTION-STRING'
          identity: appConfigIdentity.id
        }
        {
          name: 'mssql-host'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/MSSQL-HOST'
          identity: appConfigIdentity.id
        }
        {
          name: 'mssql-database-dxtr'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/MSSQL-DATABASE-DXTR'
          identity: appConfigIdentity.id
        }
        {
          name: 'mssql-client-id'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/MSSQL-CLIENT-ID'
          identity: appConfigIdentity.id
        }
        {
          name: 'mssql-encrypt'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/MSSQL-ENCRYPT'
          identity: appConfigIdentity.id
        }
        {
          name: 'mssql-trust-unsigned-cert'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/MSSQL-TRUST-UNSIGNED-CERT'
          identity: appConfigIdentity.id
        }
        {
          name: 'acms-mssql-host'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/ACMS-MSSQL-HOST'
          identity: appConfigIdentity.id
        }
        {
          name: 'acms-mssql-database'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/ACMS-MSSQL-DATABASE'
          identity: appConfigIdentity.id
        }
        {
          name: 'acms-mssql-encrypt'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/ACMS-MSSQL-ENCRYPT'
          identity: appConfigIdentity.id
        }
        {
          name: 'acms-mssql-trust-unsigned-cert'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/ACMS-MSSQL-TRUST-UNSIGNED-CERT'
          identity: appConfigIdentity.id
        }
        {
          name: 'feature-flag-sdk-key'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/FEATURE-FLAG-SDK-KEY'
          identity: appConfigIdentity.id
        }
        {
          name: 'cams-user-group-gateway-config'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/CAMS-USER-GROUP-GATEWAY-CONFIG'
          identity: appConfigIdentity.id
        }
        {
          name: 'okta-api-key'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/OKTA-API-KEY'
          identity: appConfigIdentity.id
        }
      ], 
      isUstpDeployment ? [
        {
          name: 'mssql-user'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/MSSQL-USER'
          identity: appConfigIdentity.id
        }
        {
          name: 'mssql-pass'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/MSSQL-PASS'
          identity: appConfigIdentity.id
        }
        {
          name: 'acms-mssql-user'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/ACMS-MSSQL-USER'
          identity: appConfigIdentity.id
        }
        {
          name: 'acms-mssql-pass'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/ACMS-MSSQL-PASS'
          identity: appConfigIdentity.id
        }
      ] : [
        {
          name: 'acms-mssql-client-id'
          keyVaultUrl: 'https://${kvAppConfigName}${environment().suffixes.keyvaultDns}/secrets/ACMS-MSSQL-CLIENT-ID'
          identity: appConfigIdentity.id
        }
      ])
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${containerRegistry.outputs.loginServer}/cams-api:${containerImageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: baseEnvironmentVariables
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 80
              }
              initialDelaySeconds: 30
              periodSeconds: 10
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/ready'
                port: 80
              }
              initialDelaySeconds: 10
              periodSeconds: 5
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '30'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrRoleAssignment
  ]
}

// Base environment variables (equivalent to function app settings)
var baseEnvironmentVariables = concat(
  [
    {
      name: 'CAMS_LOGIN_PROVIDER_CONFIG'
      value: loginProviderConfig
    }
    {
      name: 'CAMS_LOGIN_PROVIDER'
      value: loginProvider
    }
    {
      name: 'STARTING_MONTH'
      value: '-70'
    }
    {
      name: 'ADMIN_KEY'
      secretRef: 'admin-key'
    }
    {
      name: 'COSMOS_DATABASE_NAME'
      value: cosmosDatabaseName
    }
    {
      name: 'MONGO_CONNECTION_STRING'
      secretRef: 'mongo-connection-string'
    }
    {
      name: 'MSSQL_HOST'
      secretRef: 'mssql-host'
    }
    {
      name: 'MSSQL_DATABASE_DXTR'
      secretRef: 'mssql-database-dxtr'
    }
    {
      name: 'MSSQL_CLIENT_ID'
      secretRef: 'mssql-client-id'
    }
    {
      name: 'MSSQL_ENCRYPT'
      secretRef: 'mssql-encrypt'
    }
    {
      name: 'MSSQL_TRUST_UNSIGNED_CERT'
      secretRef: 'mssql-trust-unsigned-cert'
    }
    {
      name: 'MSSQL_REQUEST_TIMEOUT'
      value: mssqlRequestTimeout
    }
    {
      name: 'ACMS_MSSQL_HOST'
      secretRef: 'acms-mssql-host'
    }
    {
      name: 'ACMS_MSSQL_DATABASE'
      secretRef: 'acms-mssql-database'
    }
    {
      name: 'ACMS_MSSQL_ENCRYPT'
      secretRef: 'acms-mssql-encrypt'
    }
    {
      name: 'ACMS_MSSQL_TRUST_UNSIGNED_CERT'
      secretRef: 'acms-mssql-trust-unsigned-cert'
    }
    {
      name: 'ACMS_MSSQL_REQUEST_TIMEOUT'
      value: mssqlRequestTimeout
    }
    {
      name: 'FEATURE_FLAG_SDK_KEY'
      secretRef: 'feature-flag-sdk-key'
    }
    {
      name: 'CAMS_USER_GROUP_GATEWAY_CONFIG'
      secretRef: 'cams-user-group-gateway-config'
    }
    {
      name: 'OKTA_API_KEY'
      secretRef: 'okta-api-key'
    }
    {
      name: 'MAX_OBJECT_DEPTH'
      value: maxObjectDepth
    }
    {
      name: 'MAX_OBJECT_KEY_COUNT'
      value: maxObjectKeyCount
    }
    {
      name: 'INFO_SHA'
      value: gitSha
    }
    {
      name: 'PORT'
      value: '80'
    }
  ],
  createApplicationInsights
    ? [{ name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: containerAppInsights.outputs.connectionString }]
    : [],
  isUstpDeployment
    ? [
        { name: 'MSSQL_USER', secretRef: 'mssql-user' }
        { name: 'MSSQL_PASS', secretRef: 'mssql-pass' }
        { name: 'ACMS_MSSQL_USER', secretRef: 'acms-mssql-user' }
        { name: 'ACMS_MSSQL_PASS', secretRef: 'acms-mssql-pass' }
      ]
    : [
        { name: 'MSSQL_PASS', secretRef: 'mssql-client-id' }
        { name: 'ACMS_MSSQL_CLIENT_ID', secretRef: 'acms-mssql-client-id' }
      ]
)

// Create Application Insights for Container App
module containerAppInsights './lib/app-insights/container-app-insights.bicep' = {
  name: 'appi-${apiContainerAppName}-module'
  params: {
    containerAppName: apiContainerAppName
    location: location
    analyticsWorkspaceId: analyticsWorkspaceId
    createApplicationInsights: createApplicationInsights
    createAlerts: createAlerts
    actionGroupName: actionGroupName
    actionGroupResourceGroupName: actionGroupResourceGroupName
  }
}

// Note: Container Apps use the Container Apps Environment networking configuration
// Private endpoints are handled at the environment level, not individual apps

output containerAppName string = containerApp.name
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output containerRegistryName string = containerRegistry.outputs.registryName
output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
output containerAppId string = containerApp.id
output containerEnvironmentId string = containerEnvironment.outputs.environmentId
