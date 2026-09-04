#!/usr/bin/env tsx
/**
 * Minimal Mongo seed for the ui-sandbox — writes just enough into `cams-e2e` for the
 * trustee-match-verification screen to render a real field-level mismatch (non-null,
 * non-100 CandidateScore fields), which none of test/e2e's checked-in fixtures currently
 * exercise. Extend this file directly for whatever screen/scenario you're poking at next;
 * it isn't wired to any other suite, so there's nothing else to keep in sync.
 *
 * Requires MongoDB reachable at MONGO_CONNECTION_STRING (default: localhost via
 * ./start-services.sh) and writes into the `cams-e2e` database, same safety-checked name
 * test/e2e's own seed script uses.
 *
 * Usage: npx tsx scripts/seed.ts
 */
import { MongoClient } from 'mongodb';

const CONNECTION_STRING =
  process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/cams-e2e?retrywrites=false';
const DB_NAME = process.env.COSMOS_DATABASE_NAME || 'cams-e2e';

async function main() {
  if (!DB_NAME.toLowerCase().includes('e2e')) {
    throw new Error(`Safety check failed: DB_NAME must contain "e2e". Got: ${DB_NAME}`);
  }

  const client = await MongoClient.connect(CONNECTION_STRING);
  try {
    const db = client.db(DB_NAME);
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

    await db.collection('trustees').updateOne(
      { id: 'sandbox-trustee-candidate' },
      {
        $set: {
          id: 'sandbox-trustee-candidate',
          documentType: 'TRUSTEE',
          name: 'Sandbox Trustee Candidate',
          public: {
            address: {
              address1: '123 Candidate Ave',
              city: 'Poughkeepsie',
              state: 'NY',
              zipCode: '12601',
              countryCode: 'US',
            },
            phone: { number: '555-000-1111' },
            email: 'candidate@example.com',
          },
          status: 'active',
          districts: [{ courtDivisionCode: '081' }],
          chapters: ['7'],
          updatedOn: now,
          updatedBy: systemActor,
        },
      },
      { upsert: true },
    );

    await db.collection('trustee-match-verification').updateOne(
      { id: 'sandbox-trustee-match-mismatch' },
      {
        $set: {
          id: 'sandbox-trustee-match-mismatch',
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          caseId: '081-91-99999',
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'IMPERFECT_MATCH',
          dxtrTrustee: { fullName: 'Sandbox Dxtr Trustee' },
          matchCandidates: [
            {
              trusteeId: 'sandbox-trustee-candidate',
              trusteeName: 'Sandbox Trustee Candidate',
              totalScore: 58,
              addressScore: 0,
              nameScore: 0,
              phoneScore: 0,
              emailScore: 0,
              districtDivisionScore: 100,
              chapterScore: 100,
            },
          ],
          fingerprint: 'sandbox-fingerprint-mismatch',
          variant: JSON.stringify({
            firstName: 'sandbox',
            middleName: '',
            lastName: 'dxtr trustee',
            generation: '',
            address1: '999 Court Filed Rd',
            address2: '',
            address3: '',
            cityStateZipCountry: 'Albany, NY 12201',
            phone: '555-999-8888',
            fax: '',
            email: 'court-sent@example.com',
          }),
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

    console.log('Seeded sandbox-trustee-match-mismatch with a real field-level score mismatch.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
