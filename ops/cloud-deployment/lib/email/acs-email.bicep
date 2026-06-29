@description('Stack name used for resource naming')
param stackName string

param location string = 'global'

@description('Name of the Key Vault to store ACS connection string')
param kvAppConfigName string

@description('Resource group containing the Key Vault')
param kvAppConfigResourceGroupName string = resourceGroup().name

param tags object = {}

var emailServiceName = '${stackName}-email'
var communicationServiceName = '${stackName}-comms'

module emailService 'email-communication-services.bicep' = {
  name: '${stackName}-email-service-module'
  params: {
    emailServiceName: emailServiceName
    location: location
    tags: tags
  }
}

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: communicationServiceName
  location: location
  tags: tags
  properties: {
    dataLocation: 'United States'
    linkedDomains: [
      emailService.outputs.domainResourceId
    ]
  }
}

module acsConnectionStringSecret '../keyvault/keyvault-secret.bicep' = {
  name: '${stackName}-acs-connection-string-secret'
  scope: resourceGroup(kvAppConfigResourceGroupName)
  params: {
    keyVaultName: kvAppConfigName
    secretName: 'ACS-EMAIL-CONNECTION-STRING' // pragma: allowlist secret
    secretValue: communicationService.listKeys().primaryConnectionString
  }
}

module acsSenderAddressSecret '../keyvault/keyvault-secret.bicep' = {
  name: '${stackName}-acs-sender-address-secret'
  scope: resourceGroup(kvAppConfigResourceGroupName)
  params: {
    keyVaultName: kvAppConfigName
    secretName: 'ACS-EMAIL-SENDER-ADDRESS' // pragma: allowlist secret
    secretValue: emailService.outputs.senderAddress
  }
}

output senderAddress string = emailService.outputs.senderAddress
