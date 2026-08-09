/**
 * Provisions and tears down a throwaway Cosmos DB Mongo API database for
 * integration test harnesses under test/integration/ that want to validate
 * behavior against real Cosmos (as an alternative to the local Podman
 * MongoDB path). See test/integration/README.md (_lib section) for why this
 * uses the Mongo driver against MONGO_CONNECTION_STRING rather than the
 * Azure `az` CLI, and the accepted schema-drift trade-off that follows from
 * that choice.
 *
 * CLI usage (from test/integration/):
 *   npx tsx --tsconfig ../../backend/tsconfig.json _lib/ephemeral-cosmos-database.ts \
 *     stand-up --databaseName <name> --collection <name> --indexKey <field:direction,...>
 *   npx tsx --tsconfig ../../backend/tsconfig.json _lib/ephemeral-cosmos-database.ts \
 *     tear-down --databaseName <name>
 *
 * Programmatic usage (from another .ts harness):
 *   import { standUpEphemeralCosmosDatabase, tearDownEphemeralCosmosDatabase } from '../../_lib/ephemeral-cosmos-database';
 *
 * Requires MONGO_CONNECTION_STRING in the environment (e.g. sourced from a
 * local, gitignored .env -- same convention as backend/.env).
 *
 * Exitcodes (CLI mode)
 * ====================
 * 0   No error
 * 2   Unknown flag, required parameter missing, or database name doesn't
 *     match the disposable-test pattern
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { MongoClient } from 'mongodb';

const HARNESS_DIR = path.resolve(__dirname, '..');

export type IndexKeySpec = Record<string, 1 | -1>;

function log(...args: unknown[]) {
  console.error(...args);
}

function assertDisposableName(databaseName: string, action: 'stand up' | 'tear down') {
  if (!databaseName.includes('-idxtest-')) {
    throw new Error(
      `Refusing to ${action} '${databaseName}' -- ephemeral database names must contain '-idxtest-'`,
    );
  }
}

function getConnectionString(): string {
  const uri = process.env.MONGO_CONNECTION_STRING;
  if (!uri) {
    throw new Error('MONGO_CONNECTION_STRING must be set (e.g. sourced from a local .env)');
  }
  return uri;
}

/**
 * Provisions a throwaway Cosmos DB Mongo API database containing the given
 * collection with the given index applied. Materializes the database and
 * collection as a side effect of creating the index (Mongo/Cosmos has no
 * explicit CREATE DATABASE) -- the collection itself starts empty; seeding
 * fixture data is the calling harness's job, not this function's.
 *
 * Refuses to run if the database already contains the target collection, so
 * this can never silently reuse/overwrite another run's (or a human's) data.
 */
export async function standUpEphemeralCosmosDatabase(
  databaseName: string,
  collectionName: string,
  indexKey: IndexKeySpec,
): Promise<void> {
  assertDisposableName(databaseName, 'stand up');

  const client = new MongoClient(getConnectionString(), {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(databaseName);

    const existingCollections = await db.listCollections({ name: collectionName }).toArray();
    if (existingCollections.length > 0) {
      throw new Error(
        `Refusing to stand up '${databaseName}' -- collection '${collectionName}' already exists`,
      );
    }

    log(`Creating index ${JSON.stringify(indexKey)} on '${databaseName}.${collectionName}'...`);
    await db.command({
      createIndexes: collectionName,
      indexes: [{ key: indexKey, name: Object.keys(indexKey).join('_') }],
    });

    log(`Ephemeral database '${databaseName}' is ready.`);
  } finally {
    await client.close();
  }
}

/**
 * Deletes a throwaway Cosmos DB Mongo API database previously created by
 * standUpEphemeralCosmosDatabase. Intended to run unconditionally so a
 * failed test run never leaks the ephemeral database.
 *
 * Refuses to delete anything whose name doesn't look disposable, mirroring
 * test/e2e/scripts/seed-database.ts's DB_NAME guard, so a variable mix-up
 * can never delete a persistent database.
 */
export async function tearDownEphemeralCosmosDatabase(databaseName: string): Promise<void> {
  assertDisposableName(databaseName, 'tear down');

  const client = new MongoClient(getConnectionString(), {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  try {
    await client.connect();
    log(`Deleting ephemeral database '${databaseName}'...`);
    await client.db(databaseName).dropDatabase();
    log(`Deleted '${databaseName}'.`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseIndexKey(spec: string): IndexKeySpec {
  const key: IndexKeySpec = {};
  for (const pair of spec.split(',')) {
    const [field, direction] = pair.split(':');
    if (!field || (direction !== '1' && direction !== '-1')) {
      throw new Error(
        `Invalid --indexKey entry '${pair}' -- expected format 'field:1' or 'field:-1'`,
      );
    }
    key[field] = direction === '1' ? 1 : -1;
  }
  return key;
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(`Unknown or incomplete flag: ${flag ?? ''}`);
    }
    flags[flag.slice(2)] = value;
  }
  return flags;
}

function help() {
  console.log(`
ephemeral-cosmos-database — provision/tear down a throwaway Cosmos DB Mongo API database

Usage (from test/integration/):
  npx tsx --tsconfig ../../backend/tsconfig.json _lib/ephemeral-cosmos-database.ts stand-up \\
    --databaseName <name-with--idxtest-> --collection <name> --indexKey <field:1,field2:-1>
  npx tsx --tsconfig ../../backend/tsconfig.json _lib/ephemeral-cosmos-database.ts tear-down \\
    --databaseName <name-with--idxtest->

Requires MONGO_CONNECTION_STRING in the environment.
`);
}

function main() {
  dotenv.config({ path: path.join(HARNESS_DIR, '.env.local'), override: false });
  dotenv.config({ path: path.join(HARNESS_DIR, '.env'), override: false });

  const [command, ...rest] = process.argv.slice(2);

  (async () => {
    switch (command) {
      case 'stand-up': {
        const flags = parseFlags(rest);
        if (!flags.databaseName || !flags.collection || !flags.indexKey) {
          throw new Error(
            'stand-up requires --databaseName, --collection, and --indexKey (e.g. documentType:1,taskDate:1)',
          );
        }
        await standUpEphemeralCosmosDatabase(
          flags.databaseName,
          flags.collection,
          parseIndexKey(flags.indexKey),
        );
        break;
      }
      case 'tear-down': {
        const flags = parseFlags(rest);
        if (!flags.databaseName) {
          throw new Error('tear-down requires --databaseName');
        }
        await tearDownEphemeralCosmosDatabase(flags.databaseName);
        break;
      }
      case 'help':
      default:
        help();
    }
  })().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 2;
  });
}

if (require.main === module) {
  main();
}
