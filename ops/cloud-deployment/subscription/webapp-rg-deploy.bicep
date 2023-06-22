targetScope = 'subscription'
param location string 
param webappResourceGroupName string

resource rg 'Microsoft.Resources/resourceGroups@2021-01-01' = {
  name: webappResourceGroupName
  location: location
}
