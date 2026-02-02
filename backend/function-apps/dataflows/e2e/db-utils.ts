import { ApplicationContext } from '../../../lib/adapters/types/basic';
import factory from '../../../lib/factory';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { ConsolidationOrder, TransferOrder } from '@common/cams/orders';
import { CamsUserReference, UserGroup } from '@common/cams/users';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
import { Trustee } from '@common/cams/trustees';
import { SyncedCase } from '@common/cams/cases';
import { generateSearchTokens } from '../../../lib/adapters/utils/phonetic-helper';
import MockData from '@common/cams/test-utilities/mock-data';
import { createAuditRecord } from '@common/cams/auditable';

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

/**
 * Sample cases for testing hybrid search functionality.
 * Each case has debtor names with pre-generated bigram + phonetic tokens.
 *
 * Test scenarios:
 * - "John Smith" search should match "John Smith", "Jon Smith", "Jonathan Smith"
 * - "Mike Johnson" search should match "Mike Johnson", "Michael Johnson"
 * - "John" search should NOT match "Jane Doe" (different bigrams, same phonetic)
 */
export function generateHybridSearchTestCases(): SyncedCase[] {
  const testDebtors = [
    { name: 'John Smith', jointName: undefined },
    { name: 'Jon Smith', jointName: undefined },
    { name: 'Jonathan Smith', jointName: undefined },
    { name: 'Jane Doe', jointName: undefined },
    { name: 'Mike Johnson', jointName: 'Sarah Johnson' },
    { name: 'Michael Johnson', jointName: undefined },
    { name: 'Michelle Williams', jointName: undefined },
    { name: 'Robert Brown', jointName: 'Mary Brown' },
    { name: 'Bob Brown', jointName: undefined },
    { name: 'William Davis', jointName: undefined },
    { name: 'Bill Davis', jointName: undefined },
    { name: 'Elizabeth Taylor', jointName: undefined },
    { name: 'Beth Taylor', jointName: undefined },
    { name: 'Liz Taylor', jointName: undefined },
    { name: 'James Wilson', jointName: undefined },
    { name: 'Jim Wilson', jointName: undefined },
    { name: 'Jimmy Wilson', jointName: undefined },
    { name: 'Christopher Lee', jointName: undefined },
    { name: 'Chris Lee', jointName: undefined },
    { name: 'Katherine Moore', jointName: undefined },
    { name: 'Kate Moore', jointName: undefined },
    { name: 'Kathy Moore', jointName: undefined },
  ];

  return testDebtors.map((testDebtor, index) => {
    const baseSyncedCase = MockData.getSyncedCase({
      override: {
        caseId: `081-24-${String(10000 + index).padStart(5, '0')}`,
        debtor: {
          name: testDebtor.name,
          phoneticTokens: generateSearchTokens(testDebtor.name),
        },
        ...(testDebtor.jointName && {
          jointDebtor: {
            name: testDebtor.jointName,
            phoneticTokens: generateSearchTokens(testDebtor.jointName),
          },
        }),
      },
    });

    return createAuditRecord<SyncedCase>({
      ...baseSyncedCase,
      documentType: 'SYNCED_CASE',
    });
  });
}

export async function insertHybridSearchTestCases(context: ApplicationContext) {
  const casesRepo = factory.getCasesRepository(context);
  const testCases = generateHybridSearchTestCases();

  for (const testCase of testCases) {
    await casesRepo.syncDxtrCase(testCase);
    console.log(`Inserted test case: ${testCase.caseId} - ${testCase.debtor.name}`);
  }

  console.log(`\nInserted ${testCases.length} test cases for hybrid search testing.`);
  console.log('\nTest scenarios:');
  console.log('  - Search "John" → should find John Smith, Jon Smith, Jonathan Smith');
  console.log('  - Search "John" → should NOT find Jane Doe (phonetic match only)');
  console.log('  - Search "Mike" → should find Mike Johnson, Michael Johnson');
  console.log('  - Search "Bill" → should find Bill Davis, William Davis');

  casesRepo.release();
  return testCases;
}
