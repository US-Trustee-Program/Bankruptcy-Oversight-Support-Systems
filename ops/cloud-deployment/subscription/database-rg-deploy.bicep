targetScope = 'subscription'
param location string 
param databaseResourceGroupName string

resource rg 'Microsoft.Resources/resourceGroups@2021-01-01' = {
  name: databaseResourceGroupName
  location: location
}
