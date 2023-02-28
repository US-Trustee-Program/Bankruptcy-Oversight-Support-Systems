param location string
param serverFarmId string

resource bossServerFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
}

resource bossClientDev 'Microsoft.Web/sites@2021-01-15' = {
  name: 'boss-client-dev'
  location: location
  tags: {
    'hidden-related:${resourceGroup().id}/providers/Microsoft.Web/serverfarms/boss-server-farm': 'Resource'
  }
  properties: {
    serverFarmId: serverFarmId
  }
  resource bossClientSource 'sourcecontrols' = {
    name: 'web'
    properties: {
      repoUrl: 'https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/gui/'
    }
  }
}
