import {
  acsConnectionStringSecretName as acsConnectionStringSecretNameFor
  acsSenderAddressSecretName as acsSenderAddressSecretNameFor
} from '../naming.bicep'

@description('Stack name used for resource naming')
param stackName string

param location string = 'global'

@description('Name of the Key Vault to store ACS connection string')
param kvAppConfigName string

@description('Resource group containing the Key Vault')
param kvAppConfigResourceGroupName string = resourceGroup().name

param tags object = {}

@description('Custom domain FQDN (e.g. notifications.example.gov). Leave empty to use Azure-managed domain.')
param customDomain string = ''

@description('OPTIONAL. Resource id of Log Analytics workspace to send email send/delivery diagnostic logs to.')
param analyticsWorkspaceId string = ''

var emailServiceName = '${stackName}-email'
var communicationServiceName = '${stackName}-comms'

module emailService 'email-communication-services.bicep' = {
  name: '${stackName}-email-service-module'
  params: {
    emailServiceName: emailServiceName
    location: location
    tags: tags
    customDomain: customDomain
  }
}

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: communicationServiceName
  location: location
  tags: tags
  properties: {
    dataLocation: 'usgov'
    linkedDomains: [
      emailService.outputs.domainResourceId
    ]
  }
}

// This module is called unconditionally from main.bicep, which IS wrapped
// in a per-branch Deployment Stack (CAMS-760, GH #2749 bug shape).
// communicationService/emailService above are already stackName-qualified
// (each branch gets its own ACS resource, same pattern as the
// webapp/api/dataflows resources), but these two secrets previously used
// FIXED names in the SHARED kvAppConfigResourceGroupName — so every
// branch's stack ended up "managing" the same shared secret, and tearing
// down any one branch deleted it out from under main and every other
// branch. Branch-qualifying the secret name (matching the underlying
// per-branch ACS resource it stores) fixes the ownership without moving
// these into app-shared-setup.bicep, which would make the connection
// string shared across branches even though the ACS resource it points at
// is not. Both names come from naming.bicep — backend-api-deploy.bicep
// imports the same functions to build its @Microsoft.KeyVault(...)
// references, so the two can't drift apart on this name.
module acsConnectionStringSecret '../keyvault/keyvault-secret.bicep' = {
  name: '${stackName}-acs-connection-string-secret'
  scope: resourceGroup(kvAppConfigResourceGroupName)
  params: {
    keyVaultName: kvAppConfigName
    secretName: acsConnectionStringSecretNameFor(stackName) // pragma: allowlist secret
    secretValue: communicationService.listKeys().primaryConnectionString
  }
}

module acsSenderAddressSecret '../keyvault/keyvault-secret.bicep' = {
  name: '${stackName}-acs-sender-address-secret'
  scope: resourceGroup(kvAppConfigResourceGroupName)
  params: {
    keyVaultName: kvAppConfigName
    secretName: acsSenderAddressSecretNameFor(stackName) // pragma: allowlist secret
    secretValue: emailService.outputs.senderAddress
  }
}

module emailDiagnosticSetting '../app-insights/diagnostics-settings-email.bicep' = if (!empty(analyticsWorkspaceId)) {
  name: '${stackName}-email-diagnostic-setting-module'
  params: {
    settingName: '${communicationServiceName}-diagnostic-setting'
    communicationServiceName: communicationServiceName
    analyticsWorkspaceId: analyticsWorkspaceId
  }
  dependsOn: [
    communicationService
  ]
}

output senderAddress string = emailService.outputs.senderAddress
