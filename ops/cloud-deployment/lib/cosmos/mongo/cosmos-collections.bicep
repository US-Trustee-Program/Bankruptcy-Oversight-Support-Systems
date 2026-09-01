@description('Cosmos DB account name, max length 44 characters')
param accountName string

@description('Target Database')
param databaseName string

resource account 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' existing = {
  name: accountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' existing = {
  parent: account
  name: databaseName
}

resource assignmentsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'assignments'
  properties: {
    resource: {
      id: 'assignments'
      shardKey: {
        caseId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['$**']
          }
        }
        {
          key: {
            keys: ['caseId']
          }
        }
      ]
    }
  }
}

resource consolidationsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'consolidations'
  properties: {
    resource: {
      id: 'consolidations'
      shardKey: {
        consolidationId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['$**']
          }
        }
        {
          key: {
            keys: ['consolidationId']
          }
        }
      ]
    }
  }
}

resource healthcheckCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'healthcheck'
  properties: {
    resource: {
      id: 'healthcheck'
      shardKey: {
        id: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['$**']
          }
        }
        {
          key: {
            keys: ['id']
          }
        }
      ]
    }
  }
}

resource ordersCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'orders'
  properties: {
    resource: {
      id: 'orders'
      shardKey: {
        caseId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['$**']
          }
        }
        {
          key: {
            keys: ['caseId']
          }
        }
      ]
    }
  }
}

resource runtimeStateCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'runtime-state'
  properties: {
    resource: {
      id: 'runtime-state'
      shardKey: {
        documentType: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['$**']
          }
        }
        {
          key: {
            keys: ['documentType']
          }
        }
      ]
    }
  }
}

resource sessionCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'user-session-cache'
  properties: {
    resource: {
      id: 'user-session-cache'
      shardKey: {
        signature: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
        {
          key: {
            keys: [
              '$**'
            ]
          }
        }
        {
          key: {
            keys: [
              'signature'
            ]
          }
          options: {
            unique: true
          }
        }
        {
          key: {
            keys: ['_ts']
          }
          options: {
            expireAfterSeconds: -1
          }
        }
      ]
    }
  }
}

resource officesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'offices'
  properties: {
    resource: {
      id: 'offices'
      shardKey: {
        officeCode: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
        {
          key: {
            keys: [
              '$**'
            ]
          }
        }
        {
          key: {
            keys: ['_ts']
          }
          options: {
            expireAfterSeconds: -1
          }
        }
        {
          key: {
            keys: [
              'officeCode'
              'id'
            ]
          }
          options: {
            unique: true
          }
        }
      ]
    }
  }
}

resource usersCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      shardKey: {
        id: 'string'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
        {
          key: {
            keys: [
              '$**'
            ]
          }
        }
        {
          key: {
            keys: [
              'id'
              'documentType'
            ]
          }
          options: {
            unique: true
          }
        }
      ]
    }
  }
}

resource casesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'cases'
  properties: {
    resource: {
      id: 'cases'
      shardKey: {
        caseId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['id']
          }
        }
        {
          key: {
            keys: ['caseId']
          }
        }
        {
          key: {
            keys: ['caseNumber']
          }
        }
        {
          key: {
            keys: ['chapter']
          }
        }
        {
          key: {
            keys: ['courtDivisionCode']
          }
        }
        {
          key: {
            keys: ['documentType']
          }
        }
        {
          key: {
            keys: ['dateFiled', 'caseNumber']
          }
        }
        {
          key: {
            keys: ['debtor.phoneticTokens']
          }
        }
        {
          key: {
            keys: ['jointDebtor.phoneticTokens']
          }
        }
        {
          key: {
            keys: [
              'documentType'
              'dxtrId'
              'courtId'
            ]
          }
        }
        {
          key: {
            keys: ['movedToCaseId']
          }
          options: {
            sparse: true
          }
        }
        {
          key: {
            keys: [
              'documentType'
              'updatedOn'
              '_id'
            ]
          }
        }
      ]
    }
  }
}

resource officeAssigneesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'office-assignees'
  properties: {
    resource: {
      id: 'office-assignees'
      shardKey: {
        officeCode: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['caseId']
          }
        }
        {
          key: {
            keys: ['officeCode']
          }
        }
        {
          key: {
            keys: ['userId']
          }
        }
      ]
    }
  }
}

resource listsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'lists'
  properties: {
    resource: {
      id: 'lists'
      shardKey: {
        list: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['list']
          }
        }
        {
          key: {
            keys: ['key']
          }
        }
        {
          key: {
            keys: [
              'list'
              'key'
            ]
          }
          options: {
            unique: true
          }
        }
      ]
    }
  }
}

resource trusteesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'trustees'
  properties: {
    resource: {
      id: 'trustees'
      shardKey: {
        trusteeId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: [
              'documentType'
              'phoneticTokens'
            ]
          }
        }
        {
          key: {
            keys: [
              'documentType'
              'softwareId'
              'name'
            ]
          }
        }
        {
          key: {
            keys: [
              'documentType'
              'banks'
              'name'
            ]
          }
        }
      ]
    }
  }
}

resource trusteeAppointmentsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'trustee-appointments'
  properties: {
    resource: {
      id: 'trustee-appointments'
      shardKey: {
        trusteeId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['trusteeId']
          }
        }
      ]
    }
  }
}

resource caseTrusteeAppointmentsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'case-trustee-appointments'
  properties: {
    resource: {
      id: 'case-trustee-appointments'
      shardKey: {
        caseId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['caseId']
          }
        }
        {
          key: {
            keys: ['trusteeId']
          }
        }
        {
          // Supports getActiveByCaseId's query (see
          // trustee-case-appointments.mongo.repository.ts): caseId equality (the shard key)
          // narrows to one physical partition, and assignedOn as the compound suffix lets
          // Cosmos return the ORDER BY assignedOn DESC / limit 1 result directly from the index
          // instead of fetching every active appointment for the case and sorting in memory.
          // The remaining filter predicates (unassignedOn not-exists, trusteeId $ne, isSurrogate
          // $ne) are not index-seekable and are evaluated as residual filters regardless of what
          // else is in this key, so they are deliberately not included here. createdOn is
          // deliberately NOT part of this key -- see getActiveByCaseId's docblock for why it was
          // tried and reverted as a secondary sort key (CAMS-809).
          key: {
            keys: ['caseId', 'assignedOn']
          }
        }
      ]
    }
  }
}

resource trusteeCaseAppointmentsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'trustee-case-appointments'
  properties: {
    resource: {
      id: 'trustee-case-appointments'
      shardKey: {
        trusteeId: 'Hash'
      }
      // NOTE: the `indexes` property is intentionally omitted entirely (not an
      // empty array) so ARM never reconciles indexes on this collection. `_id`
      // is auto-indexed by Cosmos, and `trusteeId` (the shard key) is likewise
      // auto-indexed on sharded collections -- so the only indexes this
      // collection needs (a filtering index and a mixed-direction ORDER BY sort
      // index that Bicep/ARM's ascending-only `keys` array cannot express) are
      // both managed out-of-band by index-trustee-case-appointments.js
      // (colocated in this directory), run via the Node MongoDB driver as part
      // of every deploy in ops/scripts/pipeline/az-cosmos-deploy.sh. This was
      // verified empirically to be a true no-op (zero rebuild, zero RU cost) on
      // every run after the first -- see the Cosmos Mongo API Index Management
      // ADR (docs/architecture/decision-records/CosmosMongoIndexManagement.md)
      // for the rationale. An empty `indexes: []` array behaves differently
      // (full declarative replace -- drops anything unlisted) and must NOT be
      // used here.
    }
  }
}

resource userGroupsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'user-groups'
  properties: {
    resource: {
      id: 'user-groups'
      shardKey: {
        groupName: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['id']
          }
        }
        {
          key: {
            keys: ['groupName']
          }
        }
      ]
    }
  }
}

resource archivedCasesCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'archived-cases'
  properties: {
    resource: {
      id: 'archived-cases'
      shardKey: {
        caseId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['caseId']
          }
        }
      ]
    }
  }
}

resource trusteeProfessionalIdsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'trustee-professional-ids'
  properties: {
    resource: {
      id: 'trustee-professional-ids'
      shardKey: {
        camsTrusteeId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: [
              'camsTrusteeId'
              'acmsProfessionalId'
              'documentType'
            ]
          }
          options: {
            unique: true
          }
        }
        {
          key: {
            keys: [
              'camsTrusteeId'
              'documentType'
            ]
          }
        }
        {
          key: {
            keys: [
              'acmsProfessionalId'
            ]
          }
        }
      ]
    }
  }
}

resource bankruptcySoftwareCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'bankruptcy-software'
  properties: {
    resource: {
      id: 'bankruptcy-software'
      shardKey: {
        documentType: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['documentType']
          }
        }
        {
          key: {
            keys: ['name']
          }
        }
      ]
    }
  }
}

resource banksCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'banks'
  properties: {
    resource: {
      id: 'banks'
      shardKey: {
        documentType: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['documentType']
          }
        }
        {
          key: {
            keys: ['name']
          }
        }
      ]
    }
  }
}

resource trusteeMatchVerificationCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'trustee-match-verification'
  properties: {
    resource: {
      id: 'trustee-match-verification'
      shardKey: {
        fingerprint: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: [
              'fingerprint'
              'variant'
              'documentType'
            ]
          }
          options: {
            unique: true
          }
        }
        {
          key: {
            keys: [
              'fingerprint'
              'documentType'
            ]
          }
        }
        {
          key: {
            keys: [
              'documentType'
              'taskDate'
            ]
          }
        }
      ]
    }
  }
}

resource trusteeVariationCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'trustee-variation'
  properties: {
    resource: {
      id: 'trustee-variation'
      shardKey: {
        fingerprint: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: [
              'fingerprint'
              'variant'
              'documentType'
            ]
          }
          options: {
            unique: true
          }
        }
        {
          key: {
            keys: [
              'fingerprint'
              'documentType'
            ]
          }
        }
      ]
    }
  }
}

resource emailNotificationArchiveCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = {
  parent: database
  name: 'email-notification-archive'
  properties: {
    resource: {
      id: 'email-notification-archive'
      shardKey: {
        messageId: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['messageId']
          }
          options: {
            unique: true
          }
        }
        {
          key: {
            keys: ['_ts']
          }
          options: {
            expireAfterSeconds: -1
          }
        }
      ]
    }
  }
}
