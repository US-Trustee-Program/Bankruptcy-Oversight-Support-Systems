param location string

resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
  kind: 'linux'
}

resource webApplication 'Microsoft.Web/sites@2022-03-01' = {
  name: 'ustp-boss-dev'
  location: location
  tags: {
    acms: 'dev'
  }
  kind: 'app,linux'
  properties: {
    siteConfig: {
      appSettings: []
      linuxFxVersion: 'NODE|18 LTS'
      alwaysOn: true
      ftpsState: 'Enabled'
    }
    clientAffinityEnabled: false
    httpsOnly: true
  }
  dependsOn: []
}
