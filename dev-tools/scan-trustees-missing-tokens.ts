#!/usr/bin/env tsx
/**
 * Scan trustees collection for records missing phoneticTokens.
 *
 * Prints a list of trusteeId + name for every TRUSTEE document where
 * phoneticTokens is absent, null, or an empty array. Use this to verify
 * that the migration is complete before removing the notExists() fallback
 * branch from the optimized search endpoint.
 *
 * USAGE:
 *   npm run scan:missing-tokens -- --env=local
 *   npm run scan:missing-tokens -- --env=main
 *
 * REQUIRES:
 *   .env-dev-local  (for --env=local)
 *   .env-dev-main   (for --env=main)
 */

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(): { env: 'local' | 'main' } {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--env=')) {
      const val = arg.split('=')[1];
      if (val === 'local' || val === 'main') return { env: val };
      console.error(`Unknown --env value: ${val}. Use "local" or "main".`);
      process.exit(1);
    }
  }
  return { env: 'local' };
}

async function main() {
  const { env } = parseArgs();
  const envFile = env === 'main' ? '.env-dev-main' : '.env-dev-local';

  config({ path: resolve(__dirname, envFile) });

  const connectionString = process.env.MONGO_CONNECTION_STRING;
  if (!connectionString) {
    console.error(`MONGO_CONNECTION_STRING not set. Check ${envFile}`);
    process.exit(1);
  }

  const client = new MongoClient(connectionString);

  try {
    await client.connect();
    console.log(`Connected to MongoDB (${env})\n`);

    const collection = client.db('cams').collection('trustees');

    const missing = await collection
      .find(
        {
          documentType: 'TRUSTEE',
          $or: [
            { phoneticTokens: { $exists: false } },
            { phoneticTokens: null },
            { phoneticTokens: { $size: 0 } },
          ],
        },
        { projection: { trusteeId: 1, name: 1, _id: 0 } },
      )
      .toArray();

    const total = await collection.countDocuments({ documentType: 'TRUSTEE' });

    console.log(`Total TRUSTEE documents: ${total}`);
    console.log(`Missing phoneticTokens:  ${missing.length}\n`);

    if (missing.length === 0) {
      console.log('All trustees have phoneticTokens. Migration is complete.');
    } else {
      console.log('Trustees missing phoneticTokens:');
      console.log('─'.repeat(60));
      for (const doc of missing) {
        console.log(`  ${String(doc.trusteeId).padEnd(20)} ${doc.name}`);
      }
      console.log('─'.repeat(60));
      console.log(`\n${missing.length} trustee(s) need token backfill.`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
