/**
 * One-time migration: copy bankruptcy software entries from the legacy `lists`
 * collection into the new `bankruptcy-software` collection.
 *
 * Vendors that already exist in the `bankruptcy-software` collection (matched
 * by name, case-insensitive) are skipped so the script is safe to re-run.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json \
 *     test/migration/bankruptcy-software/CAMS-669-migrate-bankruptcy-software.ts
 *
 * After running:
 *   1. Count in `bankruptcy-software` should match count of
 *      `{ list: 'bankruptcy-software' }` documents in `lists`.
 *   2. Spot-check a few vendor names match between collections.
 *
 * Source documents are NOT deleted by this script. Remove them manually
 * once migration is confirmed in production, then also remove the
 * GET /lists/bankruptcy-software endpoint.
 */

import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '../../../common/src/cams/auditable';
import { BankruptcySoftwareProfile } from '../../../common/src/cams/bankruptcy-software';
import { Creatable } from '../../../common/src/cams/creatable';
import ApplicationContextCreator from '../../../backend/function-apps/azure/application-context-creator';
import factory from '../../../backend/lib/factory';

dotenv.config({ path: 'backend/.env' });

async function ensureIndexes() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const databaseName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !databaseName) return;

  console.log('Creating indexes on bankruptcy-software collection...');
  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const collection = client.db(databaseName).collection('bankruptcy-software');
    await collection.createIndex({ documentType: 1 });
    await collection.createIndex({ name: 1 });
    console.log('  ✓ Indexes created (documentType, name)\n');
  } finally {
    await client.close();
  }
}

async function run() {
  await ensureIndexes();

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const listsRepo = factory.getListsGateway(context);
  const softwareRepo = factory.getBankruptcySoftwareRepository(context);

  const [listItems, existingVendors] = await Promise.all([
    listsRepo.getBankruptcySoftwareList(),
    softwareRepo.getSoftwareList(),
  ]);

  console.log(`Found ${listItems.length} vendor(s) in lists collection.`);
  console.log(`Found ${existingVendors.length} vendor(s) already in bankruptcy-software collection.`);

  const existingNames = new Set(existingVendors.map((v) => v.name.toLowerCase()));
  const toMigrate = listItems.filter((item) => !existingNames.has(item.value.toLowerCase()));

  console.log(
    `Migrating ${toMigrate.length} vendor(s) (${listItems.length - toMigrate.length} already exist, skipping).\n`,
  );

  let success = 0;
  let fail = 0;

  for (const item of toMigrate) {
    const name = item.value;
    try {
      const vendorData = createAuditRecord<BankruptcySoftwareProfile>(
        {
          documentType: 'BANKRUPTCY_SOFTWARE',
          name,
          status: 'active',
        },
        SYSTEM_USER_REFERENCE,
      ) as Creatable<BankruptcySoftwareProfile>;

      const created = await softwareRepo.createSoftware(vendorData);

      await softwareRepo.createSoftwareAuditRecord(
        createAuditRecord(
          {
            documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
            softwareId: created.id,
            before: null,
            after: created,
          },
          SYSTEM_USER_REFERENCE,
        ),
      );

      console.log(`  ✓ Migrated: ${name}`);
      success++;
    } catch (err) {
      console.error(`  ✗ Failed:   ${name} — ${(err as Error).message}`);
      fail++;
    }
  }

  console.log(`\nDone. ${success} migrated, ${fail} failed.`);
}

run().catch(console.error).finally(() => process.exit(0));
