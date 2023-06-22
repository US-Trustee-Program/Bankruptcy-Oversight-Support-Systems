targetScope = 'subscription'
param location string
param networkResourceGroupName string

resource rg 'Microsoft.Resources/resourceGroups@2021-01-01' = {
  name: networkResourceGroupName
  location: location
}
