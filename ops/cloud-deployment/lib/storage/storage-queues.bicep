param storageAccountName string

param migrationTaskName string = 'migration-task'

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' existing = {
  name: storageAccountName
}

resource storageAccountQueueServices 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
  }
}

resource migrationBaseQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: storageAccountQueueServices
  name: migrationTaskName
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccount
  ]
}

resource migrationFailureQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: storageAccountQueueServices
  name: '${migrationTaskName}-fail'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccount
  ]
}

resource migrationSuccessQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: storageAccountQueueServices
  name: '${migrationTaskName}-success'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccount
  ]
}
