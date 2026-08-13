param stackName string

param location string = resourceGroup().location

@description('Disable creating Azure virtual network by default.')
param deployVnet bool = false

param networkResourceGroupName string

// This is a leaf module: its only caller (network.bicep) computes every one
// of these names/prefixes via lib/naming.bicep or its own explicit constants
// and passes all of them in. A leaf's naming defaults are never authoritative
// and only hide drift from the entry template's own values — the previous
// defaults here had already drifted (webappSubnetName vs. apiFunctionName,
// dataflowsSubnetAddressPrefix 10.10.15.0/28 vs. network.bicep's
// 10.10.13.0/28) without ever surfacing, since they were dead code. Required
// (no default) so a caller that omits one fails loudly instead of silently.
param virtualNetworkName string

param vnetAddressPrefix array = ['10.10.0.0/16']

param apiFunctionName string

param apiFunctionSubnetName string

param apiFunctionSubnetAddressPrefix string

param dataflowsFunctionName string

param dataflowsSubnetAddressPrefix string

param dataflowsSubnetName string

param webappName string

param webappSubnetName string

param webappSubnetAddressPrefix string

param privateEndpointSubnetName string

param privateEndpointSubnetAddressPrefix string

module targetVnet './vnet.bicep' = if (deployVnet) {
  name: '${stackName}-vnet-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    vnetName: virtualNetworkName
    vnetAddressPrefix: vnetAddressPrefix
    location: location
  }
}

/*
  Create subnet for private endpoint
*/
module privateEndpointSubnet './subnet.bicep' = {
  name: '${privateEndpointSubnetName}-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    subnetAddressPrefix: privateEndpointSubnetAddressPrefix
    subnetName: privateEndpointSubnetName
    virtualNetworkName: virtualNetworkName
    subnetServiceEndpoints: [
      {
        service: 'Microsoft.Sql'
        locations: [
          location
        ]
      }
      {
        service: 'Microsoft.AzureCosmosDB'
        locations: [
          location
        ]
      }
    ]
  }
  dependsOn: [
    targetVnet
  ]
}

module apiFunctionSubnet './subnet.bicep' = {
  name: '${apiFunctionName}-subnet-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    virtualNetworkName: virtualNetworkName
    subnetName: apiFunctionSubnetName
    subnetAddressPrefix: apiFunctionSubnetAddressPrefix
    subnetServiceEndpoints: [
      {
        service: 'Microsoft.Sql'
        locations: [
          location
        ]
      }
      {
        service: 'Microsoft.AzureCosmosDB'
        locations: [
          location
        ]
      }
    ]
    subnetDelegations: [
      {
        name: 'Microsoft.Web/serverfarms'
        properties: {
          serviceName: 'Microsoft.Web/serverfarms'
        }
      }
    ]
  }
  dependsOn: [
    privateEndpointSubnet
  ]
}

module dataflowsFunctionSubnet './subnet.bicep' = {
  name: '${dataflowsFunctionName}-subnet-module'
  scope: resourceGroup(networkResourceGroupName)
  params: {
    virtualNetworkName: virtualNetworkName
    subnetName: dataflowsSubnetName
    subnetAddressPrefix: dataflowsSubnetAddressPrefix
    subnetServiceEndpoints: [
      {
        service: 'Microsoft.Sql'
        locations: [
          location
        ]
      }
      {
        service: 'Microsoft.AzureCosmosDB'
        locations: [
          location
        ]
      }
    ]
    subnetDelegations: [
      {
        name: 'Microsoft.Web/serverfarms'
        properties: {
          serviceName: 'Microsoft.Web/serverfarms'
        }
      }
    ]
  }
  dependsOn: [
    privateEndpointSubnet
    apiFunctionSubnet
  ]
}

module webappSubnet './subnet.bicep' = {
  name: '${webappName}-subnet-module'
  scope: resourceGroup(networkResourceGroupName)
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
  dependsOn: [
    apiFunctionSubnet
    dataflowsFunctionSubnet
  ]
}

output privateEndpointSubnetName string = privateEndpointSubnet.outputs.subnetName
output privateEndpointSubnetId string = privateEndpointSubnet.outputs.subnetId
output apiFunctionSubnetId string = apiFunctionSubnet.outputs.subnetId
output webappSubnetId string = webappSubnet.outputs.subnetId
output dataflowsFunctionSubnetId string = dataflowsFunctionSubnet.outputs.subnetId
output cosmosDbAllowedSubnets array = [
  privateEndpointSubnet.outputs.subnetId
  apiFunctionSubnet.outputs.subnetId
  dataflowsFunctionSubnet.outputs.subnetId
]
