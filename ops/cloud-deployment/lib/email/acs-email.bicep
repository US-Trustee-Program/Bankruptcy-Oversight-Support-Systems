@description('Stack name used for resource naming')
param stackName string

param location string = 'global'

@description('Name of the Key Vault to store ACS connection string')
param kvName string

@description('Resource group containing the Key Vault')
param kvResourceGroup string = resourceGroup().name

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

module communicationService 'communication-services.bicep' = {
  name: '${stackName}-comms-service-module'
  params: {
    communicationServiceName: communicationServiceName
    location: location
    linkedDomainResourceId: emailService.outputs.domainResourceId
    tags: tags
  }
}

resource commsResource 'Microsoft.Communication/communicationServices@2023-04-01' existing = {
  name: communicationService.outputs.communicationServiceName
}

module acsConnectionStringSecret '../keyvault/keyvault-secret.bicep' = {
  name: '${stackName}-acs-connection-string-secret'
  scope: resourceGroup(kvResourceGroup)
  params: {
    keyVaultName: kvName
    secretName: 'ACS-EMAIL-CONNECTION-STRING' // pragma: allowlist secret
    secretValue: commsResource.listKeys().primaryConnectionString
  }
}

module acsSenderAddressSecret '../keyvault/keyvault-secret.bicep' = {
  name: '${stackName}-acs-sender-address-secret'
  scope: resourceGroup(kvResourceGroup)
  params: {
    keyVaultName: kvName
    secretName: 'ACS-EMAIL-SENDER-ADDRESS' // pragma: allowlist secret
    secretValue: emailService.outputs.senderAddress
  }
}

output senderAddress string = emailService.outputs.senderAddress
