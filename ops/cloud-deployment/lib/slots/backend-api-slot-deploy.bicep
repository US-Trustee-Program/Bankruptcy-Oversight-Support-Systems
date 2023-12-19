param location string = resourceGroup().location

@description('Azure functions app name')
param nodeApiName string

@description('Azure functions app deployment slot name')
param nodeApiSlotName string = 'staging'

@description('Backend private endpoint subnet name')
param privateEndpointSubnetName string = 'snet-ustp-cams-dev-5e91e7-node-api'

param stackName string = 'dev-5e91e7-node-api-staging'
@description('Resource group name of target virtual network')
param apiResourceGroupName string = 'rg-cams-app-dev-5e91e7'
// @description('Azure functions app name')
// param webappName string = 'ustp-cams-dev-5e91e7-webapp'


// @description('Existing Private DNS Zone used for application')
// param privateDnsZoneName string

// @description('Existing virtual network name')
// param virtualNetworkName string = 'vnet-ustp-cams-dev'





// @description('Backend private endpoint subnet ip ranges')
// param privateEndpointSubnetAddressPrefix string

// param kvManagedIdName string = 'id-kv-app-config-ivrlengjdhfwm'
// param sqlManagedIdName string = 'id-sql-ustp-cams-readonly-user'
// param cosmosManagedIdName string = 'id-cosmos-ustp-cams-dev-user'
// @description('Specifies the name of the Log Analytics Workspace.')
// param analyticsWorkspaceName string

@description('Storage account name. Default creates unique name from resource group id and stack name')
@minLength(3)
@maxLength(24)
param apiSlotStorageAccountName string = 'slotfunc${uniqueString(resourceGroup().id, nodeApiName)}'

resource nodeApi 'Microsoft.Web/sites@2022-09-01' existing = {
  name: nodeApiName
  scope: resourceGroup(apiResourceGroupName)
}

resource nodeApiSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-02-01' existing = {
  name: privateEndpointSubnetName
}
resource nodeApiSlot 'Microsoft.Web/sites/slots@2022-09-01' existing = {
  parent: nodeApi
  name: nodeApiSlotName
}

module privateEndpoint '../network/private-endpoint.bicep' = {
  name: 'pep-${nodeApiName}-${nodeApiSlotName}-module'
  params:{
    location: location
    serviceId: nodeApiSlot.id
    stackName: stackName
    subnetId: nodeApiSubnet.id
  }

}
module slotStorageAccount '../storage/storage-account.bicep' = {
  name: '${apiSlotStorageAccountName}-slot-storage-module'
  scope: resourceGroup(apiResourceGroupName)
  params: {
    location: location
    storageAccountName: apiSlotStorageAccountName
  }
}

// module slotDiagnosticSettings '../app-insights/diagnostics-settings-func.bicep' = {
//   name: '${functionName}-${functionSlotName}-diagnostic-settings-module'
//   params: {
//     functionAppName: '${functionName}/${functionSlotName}'
//     workspaceResourceId: analyticsWorkspace.id
//   }
//   dependsOn: [
//     functionAppSlot
//   ]
// }
output storageAccountName string = slotStorageAccount.name
