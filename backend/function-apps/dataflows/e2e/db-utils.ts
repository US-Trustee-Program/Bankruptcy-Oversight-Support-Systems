import { ApplicationContext } from '../../../lib/adapters/types/basic';
import factory from '../../../lib/factory';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { ConsolidationOrder, TransferOrder } from '@common/cams/orders';
import { CamsUserReference, UserGroup } from '@common/cams/users';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
import { Trustee } from '@common/cams/trustees';

/**
 * Deletes all documents from all collections in the MongoDB database for e2e testing.
 */
export async function clearAllCollections(context: ApplicationContext) {
  const dbName = context.config.documentDbConfig?.databaseName;
  if (!dbName?.toLowerCase().includes('e2e')) {
    throw new Error(`This dataflow must run against an e2e database. Database name: ${dbName}.`);
  }
  const { connectionString } = context.config.documentDbConfig;
  const { DocumentClient } = await import('../../../lib/humble-objects/mongo-humble');
  const client = new DocumentClient(connectionString);
  const db = client.database(dbName);
  const collections = await db.listCollections();
  for (const coll of collections) {
    const collectionName = coll.name;
    const collection = db.collection(collectionName);
    await collection.deleteMany({});
  }
  await client.close();
}

export async function insertConsolidationOrders(
  appContext: ApplicationContext,
  consolidations: ConsolidationOrder[],
) {
  const consolidationRepo = factory.getConsolidationOrdersRepository(appContext);
  await consolidationRepo.createMany(consolidations);
  console.log('Created Consolidation Orders....   ', consolidations);
  consolidationRepo.release();
}

export async function insertTransferOrders(
  appContext: ApplicationContext,
  transfers: TransferOrder[],
) {
  const transfersRepo = factory.getOrdersRepository(appContext);
  await transfersRepo.createMany(transfers);
  console.log('Created Transfer Orders....   ', transfers);
  transfersRepo.release();
}

export async function syncCases(context: ApplicationContext, caseIds: string[]) {
  const events: CaseSyncEvent[] = caseIds.map((caseId) => {
    return { type: 'CASE_CHANGED', caseId };
  });
  return await ExportAndLoadCase.exportAndLoad(context, events);
}

export async function insertTrustees(appContext: ApplicationContext, trustees: Trustee[]) {
  const trusteeRepo = factory.getTrusteesRepository(appContext);
  const testUser = {
    id: 'test-user',
    name: 'Test User',
  } as CamsUserReference;

  for (const trustee of trustees) {
    await trusteeRepo.createTrustee(trustee, testUser);
  }
  trusteeRepo.release();
}

export async function insertUserGroups(appContext: ApplicationContext, userGroups: UserGroup[]) {
  const userGroupsRepo = factory.getUserGroupsRepository(appContext);
  await userGroupsRepo.upsertUserGroupsBatch(appContext, userGroups);
  console.log('Created User Groups....   ', userGroups);
  userGroupsRepo.release();
}
