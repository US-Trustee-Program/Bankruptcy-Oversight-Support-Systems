#!/usr/bin/env tsx

/**
 * Grants or revokes an unscoped Super User permission (CAMS-940 Slice 5).
 *
 * Local Mongo (default; reads .env-dev-local):
 *   npm run superuser:grant
 *   npm run superuser:revoke
 *   MONGO_CONNECTION_STRING must point at localhost, 127.0.0.1, ::1 or the Podman 'mongodb'
 *   service, and the database is 'cams'. The user defaults to the Flexion Team account.
 *
 * A shared Cosmos account (the Azure DevOps step, or a developer targeting a branch deploy):
 *   tsx superuser/superuser.ts grant|revoke --cosmos-host <account>.mongo.cosmos.azure.us --database <name>
 *   Every host in MONGO_CONNECTION_STRING must be exactly --cosmos-host, and SEED_SUPERUSER_ID is
 *   required (no default user).
 *
 * Anything else is refused before connecting. The user is SEED_SUPERUSER_ID (Okta user id),
 * SEED_SUPERUSER_NAME and SEED_SUPERUSER_EMAIL. There is no Okta "USTP Cams Users" check, so a
 * mistyped id writes a permission nobody can use; revoke it. Revoking deactivates the permission
 * and never deletes it (locally, `npm run unseed:local` clears it with the rest of the seed data).
 */

import { MongoClient } from 'mongodb';
import { assertAllowedMongo } from './mongo-guard.js';
import {
  grantSuperUser,
  revokeSuperUser,
  type SuperUserStore,
  type SuperUserTarget,
} from './superuser-access.js';

const LOCAL_DATABASE = 'cams';
const USAGE = 'Usage: superuser grant|revoke [--cosmos-host <host> --database <name>]';
const FLEXION_TEAM: SuperUserTarget = {
  id: '00uxy2nwugG682IKt697',
  name: 'Flexion Team',
  email: 'doj-ustp-cms-team@flexion.us',
};

export type SuperUserCommandDeps = {
  openStore(
    uri: string,
    database: string,
  ): Promise<{ store: SuperUserStore; close(): Promise<void> }>;
  grantSuperUser: typeof grantSuperUser;
  revokeSuperUser: typeof revokeSuperUser;
};

async function openMongoStore(uri: string, database: string) {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(database);
  return {
    store: {
      assignments: db.collection('user-role-assignments'),
      audits: db.collection('role-assignment-audit'),
    } as SuperUserStore,
    close: () => client.close(),
  };
}

const defaultDeps: SuperUserCommandDeps = {
  openStore: openMongoStore,
  grantSuperUser,
  revokeSuperUser,
};

/** An unset or blank variable (e.g. `SEED_SUPERUSER_ID=` in .env) uses the fallback. */
function envOr(env: Record<string, string | undefined>, name: string, fallback: string) {
  return env[name]?.trim() || fallback;
}

function parseArgs(argv: string[]) {
  const [action, ...rest] = argv;
  if (action !== 'grant' && action !== 'revoke') throw new Error(USAGE);
  const options: { cosmosHost?: string; database?: string } = {};
  for (let i = 0; i < rest.length; i += 2) {
    const [flag, value] = [rest[i], rest[i + 1]];
    if (value === undefined || value.startsWith('--')) throw new Error(USAGE);
    if (flag === '--cosmos-host') options.cosmosHost = value;
    else if (flag === '--database') options.database = value;
    else throw new Error(USAGE);
  }
  return { action, ...options };
}

export async function run(
  argv: string[],
  env: Record<string, string | undefined>,
  deps: SuperUserCommandDeps = defaultDeps,
): Promise<string> {
  const { action, cosmosHost, database: databaseOption } = parseArgs(argv);
  const uri = env.MONGO_CONNECTION_STRING;
  const { hosts } = assertAllowedMongo(uri, cosmosHost === undefined ? {} : { cosmosHost });

  let database = LOCAL_DATABASE;
  let target: SuperUserTarget;
  if (cosmosHost === undefined) {
    target = {
      id: envOr(env, 'SEED_SUPERUSER_ID', FLEXION_TEAM.id),
      name: envOr(env, 'SEED_SUPERUSER_NAME', FLEXION_TEAM.name),
      email: envOr(env, 'SEED_SUPERUSER_EMAIL', FLEXION_TEAM.email!),
    };
  } else {
    if (!databaseOption?.trim()) throw new Error('--database is required with --cosmos-host.');
    database = databaseOption.trim();
    const id = env.SEED_SUPERUSER_ID?.trim();
    if (!id) throw new Error('SEED_SUPERUSER_ID is required with --cosmos-host.');
    const email = env.SEED_SUPERUSER_EMAIL?.trim();
    target = { id, name: envOr(env, 'SEED_SUPERUSER_NAME', id), ...(email ? { email } : {}) };
  }
  console.log(`[SUPERUSER] ${action} ${target.id} in ${hosts.join(',')}/${database}`);

  const { store, close } = await deps.openStore(uri!, database);
  try {
    const result =
      action === 'grant'
        ? await deps.grantSuperUser(store, target)
        : await deps.revokeSuperUser(store, target.id);
    console.log(`[SUPERUSER] ${result.outcome}`);
    return result.outcome;
  } finally {
    await close();
  }
}

// Only run when executed directly, not when imported by the test.
const isMainModule =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  run(process.argv.slice(2), process.env).catch((error: Error) => {
    console.error(`[SUPERUSER] ${error.message}`);
    process.exit(1);
  });
}
