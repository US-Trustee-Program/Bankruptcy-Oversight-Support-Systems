#!/usr/bin/env tsx
/**
 * Mongo seed for the ui-sandbox - writes arbitrary CAMS-domain fixtures into `cams-sandbox` for
 * whatever screen/scenario you're testing. Not scoped to any one feature: add a new function and
 * call it from main() for a different collection/scenario entirely (case detail, staff
 * assignments, trustee profiles, whatever the next thing you're poking at needs). This isn't
 * wired to any other suite, so there's nothing else to keep in sync when you extend it.
 *
 * The trustee identity task fixture below is just the first example seeded here - useful on its
 * own (a candidate whose name, address and phone differ from the source record, so the Data
 * Verification comparison table shows its warning markers), but not the sandbox's scope. Its
 * findings are the real pipeline's output for a fixture scenario
 * (common/src/cams/test-utilities/trustee-match-findings.scenarios.ts).
 *
 * Requires MongoDB reachable at MONGO_CONNECTION_STRING (default: localhost via
 * ./start-services.sh) and writes into the `cams-sandbox` database - the safety check below
 * only ever allows a database name containing "sandbox", so a misconfigured env pointed at a
 * real dev/production Cosmos database name (e.g. plain `cams`) fails loudly instead of silently
 * dropping and reseeding its collections.
 *
 * Usage: npx tsx scripts/seed.ts
 */
import { MongoClient } from 'mongodb';
import MockData from '@common/cams/test-utilities/mock-data';
import { TRUSTEE_MATCH_FINDINGS_SCENARIOS } from '@common/cams/test-utilities/trustee-match-findings.scenarios';
import {
  buildVariant,
  computeFingerprint,
} from '../../../backend/lib/use-cases/dataflows/trustee-variant.helpers';
import { generateSearchTokens } from '../../../backend/lib/adapters/utils/phonetic-helper';

const CONNECTION_STRING =
  process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/cams-sandbox?retrywrites=false';
const DB_NAME = process.env.COSMOS_DATABASE_NAME || 'cams-sandbox';

const SANDBOX_SCENARIO = 'oneCandidateAddressAndPhoneDiffer';

async function seedTrusteeMatchMismatch(db: ReturnType<MongoClient['db']>) {
  const now = new Date().toISOString();
  const systemActor = { id: 'SYSTEM', name: 'SYSTEM' };

  await db.collection('cases').updateOne(
    { caseId: '081-91-99999' },
    {
      $set: {
        id: 'sandbox-case-99999',
        courtDivisionCode: '081',
        caseId: '081-91-99999',
        caseNumber: '91-99999',
        caseTitle: 'Sandbox Mismatch Case',
        dateFiled: '2026-01-01',
        chapter: '7',
        courtId: '0208',
        courtName: 'Southern District of New York',
        courtDivisionName: 'Manhattan',
        regionId: '02',
        regionName: 'NEW YORK',
        petitionCode: 'VP',
        debtorTypeCode: 'IB',
        debtor: { name: 'Sandbox Debtor' },
        debtorTypeLabel: 'Individual Business',
        petitionLabel: 'Voluntary',
        documentType: 'SYNCED_CASE',
        updatedOn: now,
        updatedBy: systemActor,
      },
    },
    { upsert: true },
  );

  for (const trustee of TRUSTEE_MATCH_FINDINGS_SCENARIOS[SANDBOX_SCENARIO].trustees) {
    await db.collection('trustees').updateOne(
      { id: trustee.id },
      {
        $set: {
          ...trustee,
          documentType: 'TRUSTEE',
          phoneticTokens: generateSearchTokens(trustee.name),
        },
      },
      { upsert: true },
    );
  }

  const findings = MockData.getTrusteeMatchScenarioFindings(SANDBOX_SCENARIO);
  const variant = buildVariant(findings.sourceRaw);
  await db.collection('trustee-match-verification').updateOne(
    { id: 'sandbox-trustee-match-mismatch' },
    {
      $set: {
        id: 'sandbox-trustee-match-mismatch',
        documentType: 'TRUSTEE_MATCH_VERIFICATION',
        caseId: '081-91-99999',
        courtId: '0208',
        status: 'pending',
        mismatchReason: 'no match',
        source: 'DXTR',
        dxtrTrustee: findings.sourceRaw,
        findings,
        fingerprint: computeFingerprint(variant),
        variant,
        updatedOn: now,
        updatedBy: systemActor,
        createdOn: now,
        createdBy: systemActor,
        taskDate: now,
        taskType: 'trustee-match',
      },
    },
    { upsert: true },
  );

  console.log('Seeded sandbox-trustee-match-mismatch, a no-match identity task with findings.');
}

async function main() {
  if (!DB_NAME.toLowerCase().includes('sandbox')) {
    throw new Error(`Safety check failed: DB_NAME must contain "sandbox". Got: ${DB_NAME}`);
  }

  const client = await MongoClient.connect(CONNECTION_STRING);
  try {
    const db = client.db(DB_NAME);

    // Call whatever fixture-seeding functions you need here - add a new one for a different
    // screen/scenario rather than editing this one to do double duty.
    await seedTrusteeMatchMismatch(db);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
