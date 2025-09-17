param location string = resourceGroup().location

param stackName string = 'ustp-cams'

param apiContainerAppName string

param containerAppsEnvironmentName string

param containerRegistryName string

param apiContainerSubnetId string

param virtualNetworkResourceGroupName string

param privateEndpointSubnetId string

param mssqlRequestTimeout string

param slotName string

@description('Container image tag/version to deploy')
param containerImageTag string = 'latest'

param loginProviderConfig string

param loginProvider string

@description('Is ustp deployment')
param isUstpDeployment bool

@description('List of origins to allow. Need to include protocol')
param apiCorsAllowOrigins array = []

param sqlServerResourceGroupName string = ''

param sqlServerIdentityName string = ''

param sqlServerIdentityResourceGroupName string = ''

@description('Resource group name of the app config KeyVault')
param kvAppConfigResourceGroupName string = ''

@description('name of the app config KeyVault')
param kvAppConfigName string = 'kv-${stackName}'

param sqlServerName string = ''

@description('Flag to enable Vercode access')
param allowVeracodeScan bool = false

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

param privateDnsZoneName string = 'privatelink.azurecontainerapps.us'

param privateDnsZoneResourceGroup string = virtualNetworkResourceGroupName

@description('DNS Zone Subscription ID. USTP uses a different subscription for prod deployment.')
param privateDnsZoneSubscriptionId string = subscription().subscriptionId

param maxObjectDepth string

param maxObjectKeyCount string

param gitSha string

output containerAppName string = apiContainerAppName
output containerAppFqdn string = 'placeholder-fqdn'
output containerRegistryName string = containerRegistryName
