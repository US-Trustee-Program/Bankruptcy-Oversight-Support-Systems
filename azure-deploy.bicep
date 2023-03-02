param location string

resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
  properties: {
    reserved: true
  }
  kind: 'linux'
}

resource webApplication 'Microsoft.Web/sites@2021-01-15' = {
  name: 'ustp-boss-dev'
  location: location
  tags: {
    acms: 'dev'
  }
  properties: {
    siteConfig: {
      appSettings: []
      linuxFxVersion: 'node|18'
      alwaysOn: true
      ftpsState: 'Enabled'
    }
    clientAffinityEnabled: false
    httpsOnly: true
  }
  dependsOn: []
}
