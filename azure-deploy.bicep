param location string

resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  location: location
  name: 'boss-server-farm'
}

resource name_resource 'Microsoft.Web/sites@2021-01-15' = {
  name: 'ustp-boss-dev'
  location: location
  tags: {
    acms: 'dev'
  }
  properties: {
    siteConfig: {
      appSettings: []
      linuxFxVersion: 'NODE:18-lts'
      alwaysOn: true
      ftpsState: 'Enabled'
    }
    clientAffinityEnabled: false
    httpsOnly: true
  }
  dependsOn: []
}
