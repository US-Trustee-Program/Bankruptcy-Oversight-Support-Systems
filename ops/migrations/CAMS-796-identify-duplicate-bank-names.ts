/**
 * Read-only report: find bank names in the `banks` collection that collide
 * under case-insensitive, trimmed uniqueness (the rule enforced by
 * `BanksUseCase`, see backend/lib/use-cases/banks/banks.ts).
 *
 * Because that rule is enforced in the use case rather than by a database
 * constraint, any duplicates that existed before enforcement was added
 * remain in the collection. This script reports them; it does not modify
 * any data. Resolve each reported group manually (rename or inactivate the
 * redundant entries).
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json \
 *     ops/migrations/CAMS-796-identify-duplicate-bank-names.ts
 *
 * Exits with status 1 if any duplicate groups are found, 0 otherwise, so it
 * can be used as a CI/ops gate.
 */

import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: 'backend/.env' });

type DuplicateGroup = {
  _id: string;
  count: number;
  ids: string[];
  names: string[];
};

async function run(): Promise<DuplicateGroup[]> {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const databaseName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !databaseName) {
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set.');
  }

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const collection = client.db(databaseName).collection('banks');

    return await collection
      .aggregate<DuplicateGroup>([
        { $match: { documentType: 'BANK_PROFILE' } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$name' } } },
            count: { $sum: 1 },
            ids: { $push: '$id' },
            names: { $push: '$name' },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();
  } finally {
    await client.close();
  }
}

run()
  .then((duplicateGroups) => {
    if (duplicateGroups.length === 0) {
      console.log('No duplicate bank names found.');
      process.exit(0);
    }

    console.log(`Found ${duplicateGroups.length} duplicate bank name group(s):\n`);
    for (const group of duplicateGroups) {
      console.log(`  "${group._id}" (${group.count} banks)`);
      for (let i = 0; i < group.ids.length; i++) {
        console.log(`    - id=${group.ids[i]} name="${group.names[i]}"`);
      }
    }
    console.log('\nResolve each group manually (rename or inactivate the redundant entries).');
    process.exit(1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
