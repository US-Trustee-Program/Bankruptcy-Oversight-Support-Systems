param location string

resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
  properties: {
    reserved: true
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
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
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: true
      ftpsState: 'Enabled'
    }
    clientAffinityEnabled: false
    httpsOnly: true
  }
  dependsOn: []
}
