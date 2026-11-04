/**
 * Scenario: sync-cases-terminal-transaction
 * Database: dxtr only (deliberately no Cosmos SYNCED_CASE document)
 *
 * Seeds a case that DXTR only flags as changed through a terminal transaction
 * (AO_TX, not AO_CS.LAST_UPDATE_DATE) — the "blind spot" query in
 * CasesDxtrGateway.getUpdatedCaseIds that PR #3212 (CAMS-946) fixed. That query
 * used to build the returned caseId from AO_TX.CS_CASEID (DXTR's internal key)
 * instead of AO_CS.CASE_ID (the public case number), so every case caught only
 * this way failed its downstream case lookup and landed in sync-cases-dlq
 * instead of syncing. See .ustp-cams-fdp/ai/specs/CAMS-946-seed-data/notes.md
 * for the full before/after trace.
 *
 *   - Chapter 7 case 081-26-98100 in DXTR (AO_CS + AO_PY debtor), with
 *     LAST_UPDATE_DATE fixed in the past so the AO_CS.LAST_UPDATE_DATE query
 *     does NOT also pick this case up — this scenario exists specifically to
 *     isolate the AO_TX-driven query.
 *   - One terminal transaction (AO_TX, TX_CODE='CBC') dated after any
 *     reasonable transactionsStart watermark, on the same CS_CASEID+COURT_ID.
 *
 * No Cosmos document is seeded on purpose: run sync-cases's handleStart (or
 * call CasesDxtrGateway.getUpdatedCaseIds directly) against this data and
 * confirm the case actually syncs into CAMS, rather than pre-seeding the
 * outcome.
 *
 * NOTE: Uses fixed case number 081-26-98100 for predictable testing.
 *       Uses ensureDxtrCase() to work with existing DXTR data if present.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';

const DIVISION_CODE = '081'; // Manhattan
const COURT_ID = '0208';
const CASE_YEAR = '26';
const CASE_NUMBER = '98100';
const CASE_ID = `${DIVISION_CODE}-${CASE_YEAR}-${CASE_NUMBER}`;
const CS_CASEID = 'SEED98100';

// Older than any reasonable casesStart watermark, so the LAST_UPDATE_DATE query
// does not also catch this case.
const LAST_UPDATE_DATE = new Date('2024-01-01');

// After any reasonable transactionsStart watermark used in a test.
const TERMINAL_TX_DATE = new Date('2026-01-01');

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const debtorName = 'SEED Terminal Transaction Test';

  // Ensure case exists in DXTR (uses existing if found, creates if not)
  const { operations: dxtrOps } = await ensureDxtrCase(ctx, {
    divisionCode: DIVISION_CODE,
    chapter: '7',
    debtorName,
    courtId: COURT_ID,
    groupDesignator: 'NY',
    caseInfo: {
      caseId: CASE_ID,
      caseNumber: `${CASE_YEAR}-${CASE_NUMBER}`,
      csCaseId: CS_CASEID,
    },
  });

  // Pin LAST_UPDATE_DATE on the AO_CS row ensureDxtrCase() returns, since it
  // doesn't set one itself. Without this, whatever default the real AO_CS
  // table applies on insert could be recent enough to also satisfy the
  // LAST_UPDATE_DATE query, defeating the isolation this scenario needs.
  const aoCsOp = dxtrOps.find((op) => op.collectionOrTable === 'AO_CS');
  if (aoCsOp) {
    aoCsOp.data[0] = { ...aoCsOp.data[0], LAST_UPDATE_DATE };
  }

  return [
    // ── DXTR operations (if case doesn't exist) ──────────────────────────────
    ...dxtrOps,

    // ── DXTR: terminal transaction (the AO_TX blind-spot query's input) ─────
    // AO_TX's real primary key is TX_ID (IDENTITY) — there is no natural
    // unique key across (CS_CASEID, COURT_ID) in general, since a case has
    // many transactions. This scenario seeds exactly one transaction per
    // case, so using (CS_CASEID, COURT_ID) as the MERGE key with insertOnly
    // is safe here and makes reseeding idempotent. Do not reuse this pattern
    // for a scenario that needs more than one AO_TX row per case.
    {
      db: 'dxtr',
      collectionOrTable: 'AO_TX',
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      insertOnly: true,
      data: [
        {
          CS_CASEID: CS_CASEID,
          COURT_ID: COURT_ID,
          // AO_TX carries its own denormalized copy of the public case number.
          CASE_ID: `${CASE_YEAR}-${CASE_NUMBER}`,
          TX_TYPE: 'O',
          TX_CODE: 'CBC',
          TX_DATE: TERMINAL_TX_DATE,
          // NOT NULL FK-shaped link to AO_DE(CS_CASEID, COURT_ID, DE_SEQNO), but the
          // terminal-transaction query under test never joins AO_DE, so an unseeded
          // placeholder value is sufficient here.
          DE_SEQNO: 1,
          // NOT NULL batch-job identifier; unused by the terminal-transaction query.
          JOB_ID: 1,
          REC: 'SEED terminal transaction row — content unused by the caseId-construction query'.padEnd(
            237,
            ' ',
          ),
        },
      ],
    },
  ];
}
