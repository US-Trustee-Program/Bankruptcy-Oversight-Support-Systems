targetScope = 'subscription'
param databaseResourceGroupName string 
param networkResourceGroupName string 
param webappResourceGroupName string 
param location string = 'eastus'
param azSubscription string

module appResourceGroup './webapp-rg-deploy.bicep' = {
  scope: subscription(azSubscription)
  name: webappResourceGroupName
  params: {
    location: location
    webappResourceGroupName: webappResourceGroupName
  }
}
module networkResourceGroup './network-rg-deploy.bicep' = {
  scope: subscription(azSubscription)
  name: networkResourceGroupName
  params: {
    location: location
    networkResourceGroupName: networkResourceGroupName
  }
}
module databaseResourceGroup './database-rg-deploy.bicep' = {
  scope: subscription(azSubscription)
  name: databaseResourceGroupName
  params: {
    location: location
    databaseResourceGroupName: databaseResourceGroupName
  }
}
