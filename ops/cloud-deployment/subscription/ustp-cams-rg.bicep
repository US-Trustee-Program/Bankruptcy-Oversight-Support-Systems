targetScope = 'subscription'
param databaseResourceGroupName string
param networkResourceGroupName string
param webappResourceGroupName string
param createAppRG bool = false
param createNetworkRG bool = false
param createDatabaseRG bool = false
param location string = 'eastus'
param azSubscription string

module appResourceGroup './webapp-rg-deploy.bicep' = if(createAppRG){
  scope: subscription(azSubscription)
  name: webappResourceGroupName
  params: {
    location: location
    webappResourceGroupName: webappResourceGroupName
  }
}
module networkResourceGroup './network-rg-deploy.bicep' = if(createNetworkRG){
  scope: subscription(azSubscription)
  name: networkResourceGroupName
  params: {
    location: location
    networkResourceGroupName: networkResourceGroupName
  }
}
module databaseResourceGroup './database-rg-deploy.bicep' = if(createDatabaseRG){
  scope: subscription(azSubscription)
  name: databaseResourceGroupName
  params: {
    location: location
    databaseResourceGroupName: databaseResourceGroupName
  }
}
