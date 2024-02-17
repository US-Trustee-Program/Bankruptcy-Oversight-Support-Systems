targetScope = 'subscription'

param databaseResourceGroupName string
param networkResourceGroupName string
param webappResourceGroupName string
param createAppRG bool = false
param createNetworkRG bool = false
param createDatabaseRG bool = false
param location string = 'eastus'
@secure()
param azSubscription string

@description('Set to true if creating resource group for branch deployment')
param isBranchDeployment bool = false
@description('Git branch name resources are deployed from')
param branchName string = ''
@description('Short hash identifier of branch deployment')
param branchHashId string = ''

var resourceGroupNames = [ {
    name: databaseResourceGroupName
    create: createDatabaseRG
  }
  {
    name: networkResourceGroupName
    create: createNetworkRG
  }
  {
    name: webappResourceGroupName
    create: createAppRG
  }
]
module resourceGroup './resource-group-deploy.bicep' = [for item in resourceGroupNames: if (item.create) {
  scope: subscription(azSubscription)
  name: 'rg-module-${item.name}'
  params: {
    location: location
    resourceGroupName: item.name
    tags: isBranchDeployment ? {
      // Expected tags to set on Azure Resource Group for resources deployed for branch deploys
      isBranchDeployment: isBranchDeployment
      branchName: branchName
      branchHashId: branchHashId
    } : {}
  }
}]
