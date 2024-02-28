targetScope = 'subscription'
param location string
param resourceGroupName string
param tags object

resource resourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}
