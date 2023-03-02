param subscriptionId string
param location string
param resourceGroupName string

resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
}

resource name_resource 'Microsoft.Web/sites@2018-11-01' = {
  name: 'ustp-boss-dev'
  location: location
  tags: {
    acms: 'uat'
  }
  properties: {
    name: 'ustp-boss-dev'
    siteConfig: {
      appSettings: []
      linuxFxVersion: 'NODE:18-lts'
      alwaysOn: true
      ftpsState: 'Enabled'
    }
    serverFarmId: '/subscriptions/${subscriptionId}/resourcegroups/${resourceGroupName}/providers/Microsoft.Web/serverfarms/boss-server-farm'
    clientAffinityEnabled: false
    virtualNetworkSubnetId: null
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
  }
  dependsOn: []
}
