#!/usr/bin/env tsx
/**
 * Seeds fixture users into the local `okta.users` collection the fake-okta server reads from.
 * Edit the FIXTURE_USERS array directly for whatever principal/role/office combination you need
 * next - there's no other suite pinned against this collection, so nothing else to keep in sync.
 *
 * `groups` values must match idp_group_name entries in backend/lib/adapters/gateways/storage/
 * local-storage-gateway.ts (role mapping) and common/src/cams/test-utilities/offices.mock.ts
 * (office/region mapping) to get real roles/office scoping - group names that don't match either
 * table just carry no permissions/office, which is a valid fixture too (e.g. "no role" users).
 *
 * Usage: npx tsx fake-okta/seed-users.ts
 */
import { MongoClient } from 'mongodb';
import type { FakeOktaUser } from './users';
import { OKTA_DB_NAME, OKTA_USERS_COLLECTION } from './users';

const MONGO_CONNECTION_STRING =
  process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/cams-sandbox?retrywrites=false';

const FIXTURE_USERS: FakeOktaUser[] = [
  {
    sub: 'super-user@fake.com',
    name: 'Sandbox Super User',
    email: 'super-user@fake.com',
    groups: ['USTP CAMS Super User'],
  },
  {
    sub: 'data-verifier@fake.com',
    name: 'Sandbox Data Verifier (Manhattan)',
    email: 'data-verifier@fake.com',
    groups: ['USTP CAMS Data Verifier', 'USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'trial-attorney@fake.com',
    name: 'Sandbox Trial Attorney (Manhattan)',
    email: 'trial-attorney@fake.com',
    groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'no-role@fake.com',
    name: 'Sandbox No Role',
    email: 'no-role@fake.com',
    groups: [],
  },
];

async function main() {
  const client = await MongoClient.connect(MONGO_CONNECTION_STRING);
  try {
    const db = client.db(OKTA_DB_NAME);
    const collection = db.collection<FakeOktaUser>(OKTA_USERS_COLLECTION);
    for (const user of FIXTURE_USERS) {
      await collection.updateOne({ sub: user.sub }, { $set: user }, { upsert: true });
    }
    console.log(
      `Seeded ${FIXTURE_USERS.length} fake-okta users into ${OKTA_DB_NAME}.${OKTA_USERS_COLLECTION}`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
