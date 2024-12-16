param storageAccounts_migrationslot_name string = 'migrationslot'

resource storageAccounts_migrationslot_name_resource 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccounts_migrationslot_name
  location: 'usgovvirginia'
  sku: {
    name: 'Standard_RAGRS'
    tier: 'Standard'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_0'
    allowBlobPublicAccess: false
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

resource storageAccounts_migrationslot_name_default 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccounts_migrationslot_name_resource
  name: 'default'
  sku: {
    name: 'Standard_RAGRS'
    tier: 'Standard'
  }
  properties: {
    cors: {
      corsRules: []
    }
    deleteRetentionPolicy: {
      allowPermanentDelete: false
      enabled: false
    }
  }
}

resource Microsoft_Storage_storageAccounts_fileServices_storageAccounts_migrationslot_name_default 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storageAccounts_migrationslot_name_resource
  name: 'default'
  sku: {
    name: 'Standard_RAGRS'
    tier: 'Standard'
  }
  properties: {
    protocolSettings: {
      smb: {}
    }
    cors: {
      corsRules: []
    }
    shareDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storageAccounts_migrationslot_name_resource
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
  }
}

resource Microsoft_Storage_storageAccounts_tableServices_storageAccounts_migrationslot_name_default 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccounts_migrationslot_name_resource
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
  }
}

resource storageAccounts_migrationslot_name_default_azure_webjobs_hosts 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: storageAccounts_migrationslot_name_default
  name: 'azure-webjobs-hosts'
  properties: {
    immutableStorageWithVersioning: {
      enabled: false
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
    publicAccess: 'None'
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_azure_webjobs_secrets 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: storageAccounts_migrationslot_name_default
  name: 'azure-webjobs-secrets'
  properties: {
    immutableStorageWithVersioning: {
      enabled: false
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
    publicAccess: 'None'
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_staging_applease 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: storageAccounts_migrationslot_name_default
  name: 'staging-applease'
  properties: {
    immutableStorageWithVersioning: {
      enabled: false
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
    publicAccess: 'None'
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_staging_leases 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: storageAccounts_migrationslot_name_default
  name: 'staging-leases'
  properties: {
    immutableStorageWithVersioning: {
      enabled: false
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
    publicAccess: 'None'
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_migration_task 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default
  name: 'migration-task'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_migration_task_fail 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default
  name: 'migration-task-fail'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_migration_task_success 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default
  name: 'migration-task-success'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_staging_control_00 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default
  name: 'staging-control-00'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_staging_control_01 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default
  name: 'staging-control-01'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_staging_control_02 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default
  name: 'staging-control-02'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_staging_control_03 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default
  name: 'staging-control-03'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_staging_workitems 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_queueServices_storageAccounts_migrationslot_name_default
  name: 'staging-workitems'
  properties: {
    metadata: {}
  }
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_AzureFunctionsDiagnosticEvents202412 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_migrationslot_name_default
  name: 'AzureFunctionsDiagnosticEvents202412'
  properties: {}
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_stagingHistory 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_migrationslot_name_default
  name: 'stagingHistory'
  properties: {}
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}

resource storageAccounts_migrationslot_name_default_stagingInstances 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_migrationslot_name_default
  name: 'stagingInstances'
  properties: {}
  dependsOn: [
    storageAccounts_migrationslot_name_resource
  ]
}
