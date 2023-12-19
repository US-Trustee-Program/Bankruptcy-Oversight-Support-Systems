param location string = resourceGroup().location

@description('Azure functions app name')
param functionName string

@description('Azure functions app deployment slot name')
param functionSlotName string = 'staging'

@description('Existing Private DNS Zone used for application')
param privateDnsZoneName string

@description('Existing virtual network name')
param virtualNetworkName string

@description('Resource group name of target virtual network')
param virtualNetworkResourceGroupName string

@description('Backend private endpoint subnet name')
param privateEndpointSubnetName string

@description('Backend private endpoint subnet ip ranges')
param privateEndpointSubnetAddressPrefix string

param kvManagedIdName string = 'id-kv-app-config-ivrlengjdhfwm'
param sqlManagedIdName string = 'id-sql-ustp-cams-readonly-user'
param cosmosManagedIdName string = 'id-cosmos-ustp-cams-dev-user'
// @description('Specifies the name of the Log Analytics Workspace.')
// param analyticsWorkspaceName string

@description('Storage account name. Default creates unique name from resource group id and stack name')
@minLength(3)
@maxLength(24)
param slotFunctionsStorageName string = 'slotfunc${uniqueString(resourceGroup().id, functionName)}'

resource functionApp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: functionName
}
resource kvManagedId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: kvManagedIdName
}
resource sqlManagedId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: sqlManagedIdName
}
resource cosmosManagedId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: cosmosManagedIdName
}
resource functionAppSlot 'Microsoft.Web/sites/slots@2022-09-01' = {
  parent: functionApp
  name: functionSlotName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${kvManagedId.id}': {}
      '${sqlManagedId.id}': {}
      '${cosmosManagedId.id}': {}
    }
  }
}
// resource analyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
//   name: analyticsWorkspaceName
// }
module slotPrivateEndpoint '../network/subnet-private-endpoint.bicep' = {
  name: '${functionName}-${functionSlotName}-pep-module'
  scope: resourceGroup(virtualNetworkResourceGroupName)
  params: {
    privateLinkGroup: 'sites'
    stackName: '${functionName}-${functionSlotName}'
    location: location
    virtualNetworkName: virtualNetworkName
    privateDnsZoneName: privateDnsZoneName
    privateEndpointSubnetName: privateEndpointSubnetName
    privateEndpointSubnetAddressPrefix: privateEndpointSubnetAddressPrefix
    privateLinkServiceId: functionAppSlot.id
  }
}
resource slotStorageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: slotFunctionsStorageName
  location: location
  tags: {
    'Stack Name': '${functionName}-${functionSlotName}'
  }
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'Storage'
  properties: {
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
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
