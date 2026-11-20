#!/usr/bin/env tsx

/**
 * Grants or revokes an unscoped Super User permission (CAMS-940 Slice 5).
 *
 * Flexion's dev and main Cosmos accounts (the 'cams' database branch deploys share):
 *   npm run superuser:grant:dev    npm run superuser:revoke:dev     (reads .env-dev-local)
 *   npm run superuser:grant:main   npm run superuser:revoke:main    (reads .env-dev-main)
 *   The user defaults to the Flexion Team account.
 *
 * Any other Cosmos account (e.g. the Azure DevOps step against USTP's):
 *   tsx superuser/superuser.ts grant|revoke --cosmos-host <account>.mongo.cosmos.azure.us --database <name>
 *   Every host in MONGO_CONNECTION_STRING must be exactly --cosmos-host, and SEED_SUPERUSER_ID is
 *   required (no default user).
 *
 * A Mongo on this machine (no --cosmos-host): MONGO_CONNECTION_STRING must point at localhost,
 *   127.0.0.1, ::1 or the Podman 'mongodb' service, and the database is 'cams'. The user defaults
 *   to the Flexion Team account.
 *
 * Anything else is refused before connecting. The user is SEED_SUPERUSER_ID (Okta user id),
 * SEED_SUPERUSER_NAME and SEED_SUPERUSER_EMAIL. There is no Okta "USTP Cams Users" check, so a
 * mistyped id writes a permission nobody can use; revoke it. Revoking deactivates the permission
 * and never deletes it; `unseed` does not touch these collections.
 */

import { pathToFileURL } from 'node:url';
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
const FLEXION_HOSTS = new Set([
  'cosmos-mongo-ustp-cams-dev.mongo.cosmos.azure.us',
  'cosmos-mongo-ustp-cams.mongo.cosmos.azure.us',
]);

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

/** A blank variable (e.g. `SEED_SUPERUSER_ID=` in .env) counts as unset. */
function envValue(env: Record<string, string | undefined>, name: string) {
  return env[name]?.trim() || undefined;
}

/**
 * The user named by SEED_SUPERUSER_*, or the Flexion Team account when none is named and the
 * target allows it. A named user's display name comes only from SEED_SUPERUSER_NAME, never from
 * Flexion Team or the id; it is optional here because revoke needs only the id.
 */
function targetFrom(
  env: Record<string, string | undefined>,
  flexionDefaultAllowed: boolean,
): Omit<SuperUserTarget, 'name'> & { name?: string } {
  const id = envValue(env, 'SEED_SUPERUSER_ID');
  if (!id) {
    if (flexionDefaultAllowed) return FLEXION_TEAM;
    throw new Error('SEED_SUPERUSER_ID is required with --cosmos-host.');
  }
  const name = envValue(env, 'SEED_SUPERUSER_NAME');
  const email = envValue(env, 'SEED_SUPERUSER_EMAIL');
  return { id, ...(name ? { name } : {}), ...(email ? { email } : {}) };
}

/** A grant writes the display name onto the permission and its audit entries, so it needs one. */
function withName({ name, ...rest }: ReturnType<typeof targetFrom>): SuperUserTarget {
  if (!name) throw new Error('SEED_SUPERUSER_NAME is required with SEED_SUPERUSER_ID.');
  return { ...rest, name };
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
  if (cosmosHost === undefined && databaseOption !== undefined) {
    throw new Error('--database is only used with --cosmos-host.');
  }
  const uri = env.MONGO_CONNECTION_STRING;
  const { hosts } = assertAllowedMongo(uri, cosmosHost === undefined ? {} : { cosmosHost });

  let database = LOCAL_DATABASE;
  if (cosmosHost !== undefined) {
    if (!databaseOption?.trim()) throw new Error('--database is required with --cosmos-host.');
    database = databaseOption.trim();
  }
  const target = targetFrom(env, cosmosHost === undefined || FLEXION_HOSTS.has(hosts[0]));
  const grantTarget = action === 'grant' ? withName(target) : null;
  console.log(`[SUPERUSER] ${action} ${target.id} in ${hosts.join(',')}/${database}`);

  const { store, close } = await deps.openStore(uri!, database);
  try {
    const result = grantTarget
      ? await deps.grantSuperUser(store, grantTarget)
      : await deps.revokeSuperUser(store, target.id);
    console.log(`[SUPERUSER] ${result.outcome}`);
    return result.outcome;
  } finally {
    await close();
  }
}

// Only run when executed directly, not when imported by the test.
const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  run(process.argv.slice(2), process.env).catch((error: Error) => {
    console.error(`[SUPERUSER] ${error.message}`);
    process.exit(1);
  });
}
