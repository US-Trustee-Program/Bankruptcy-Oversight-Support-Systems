param location string

resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
  sku: {
    name: 'P1V2'
    size: 'P1V2'
    capacity: 1
  }
  properties: {
    reserved: true
  }
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
      alwaysOn: true
      ftpsState: 'Enabled'
    }
    clientAffinityEnabled: false
    httpsOnly: true
  }
  dependsOn: []
}
