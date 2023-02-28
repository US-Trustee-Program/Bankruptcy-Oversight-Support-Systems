param location string
param serverFarmId string

resource bossServerFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
}

resource bossClientDev 'Microsoft.Web/sites@2021-01-15' = {
  name: 'ustp-boss'
  location: location
  tags: {
    'hidden-related:${resourceGroup().id}/providers/Microsoft.Web/serverfarms/boss-server-farm': 'Resource'
  }
  properties: {
    serverFarmId: serverFarmId
  }
}
