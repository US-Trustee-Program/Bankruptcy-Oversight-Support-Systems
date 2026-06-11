/**
 * Check active status distribution in the ATS CHAPTER_DETAILS table.
 *
 * Verifies the active-only trustee filter (Slice 1) and the CAMS-772 ARCHIVE_DATE
 * condition are both working as expected before running a migration batch.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/check-active-status.ts
 *
 * Output:
 *   - All distinct STATUS values with row counts
 *   - How many trustees have at least one active appointment (will be migrated)
 *   - How many trustees have no appointments or only inactive ones (will be skipped)
 *   - CAMS-772: How many trustees have archived appointments that will import as inactive
 */

import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import factory from '../../../../backend/lib/factory';
import { ACTIVE_STATUS_CODES } from '../../../../backend/lib/adapters/gateways/ats/ats.constants';
import { ARCHIVE_STATUS_LABELS } from './shared';

dotenv.config({ path: 'backend/.env' });

type Row = Record<string, string | number | null | Date>;

async function checkActiveStatus() {
  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const gateway = factory.getAtsGateway(context);

  console.log('='.repeat(60));
  console.log('ATS Active Status Check');
  console.log('='.repeat(60));

  const activeCodesInList = [...ACTIVE_STATUS_CODES].map((c) => `'${c}'`).join(', ');
  console.log(`\nActive STATUS codes: ${activeCodesInList}\n`);

  // -------------------------------------------------------------------------
  // 1. All distinct STATUS values with row counts
  // -------------------------------------------------------------------------
  const statusDistQuery = `
    SELECT
      ISNULL(STATUS, '(null)') AS STATUS,
      COUNT(*) AS row_count,
      COUNT(DISTINCT TRU_ID) AS trustee_count
    FROM CHAPTER_DETAILS
    GROUP BY STATUS
    ORDER BY row_count DESC
  `;
  const statusResult = await gateway.executeQuery(context, statusDistQuery, []);
  const statusRows = statusResult.results.recordset as Row[];

  console.log('STATUS distribution in CHAPTER_DETAILS:');
  console.log('─'.repeat(55));
  console.log('  STATUS'.padEnd(12) + 'rows'.padStart(10) + '  trustees');
  console.log('─'.repeat(55));
  for (const row of statusRows) {
    const isActive = ACTIVE_STATUS_CODES.has(String(row.STATUS));
    const marker = isActive ? ' ✓' : '  ';
    console.log(
      `${marker} ${String(row.STATUS).padEnd(10)} ${String(row.row_count).padStart(10)}  ${row.trustee_count}`,
    );
  }
  console.log('  ✓ = active STATUS code (will be included in migration)');

  // -------------------------------------------------------------------------
  // 2. Trustee counts — who gets migrated vs. skipped
  // -------------------------------------------------------------------------
  const totalTrusteesQuery = `SELECT COUNT(*) AS total FROM TRUSTEES`;
  const totalResult = await gateway.executeQuery(context, totalTrusteesQuery, []);
  const totalRows = totalResult.results.recordset as Row[];
  const totalTrustees = Number(totalRows[0]?.total ?? 0);

  const activeFilterQuery = `
    SELECT COUNT(*) AS active_count
    FROM TRUSTEES T
    WHERE EXISTS (
      SELECT 1 FROM CHAPTER_DETAILS CD
      WHERE CD.TRU_ID = T.ID
        AND CD.STATUS IN (${activeCodesInList})
    )
  `;
  const activeResult = await gateway.executeQuery(context, activeFilterQuery, []);
  const activeRows = activeResult.results.recordset as Row[];
  const activeTrustees = Number(activeRows[0]?.active_count ?? 0);
  const skippedTrustees = totalTrustees - activeTrustees;

  console.log('\nTrustee migration scope:');
  console.log('─'.repeat(55));
  console.log(`  Total trustees in TRUSTEES table  : ${totalTrustees}`);
  console.log(`  Trustees with any active STATUS   : ${activeTrustees}  (will be migrated)`);
  console.log(`  Trustees skipped (no active appt) : ${skippedTrustees}  (filtered out)`);

  // -------------------------------------------------------------------------
  // 3. Trustees with no appointments at all
  // -------------------------------------------------------------------------
  const noApptsQuery = `
    SELECT COUNT(*) AS no_appt_count
    FROM TRUSTEES T
    WHERE NOT EXISTS (
      SELECT 1 FROM CHAPTER_DETAILS CD WHERE CD.TRU_ID = T.ID
    )
  `;
  const noApptsResult = await gateway.executeQuery(context, noApptsQuery, []);
  const noApptsRows = noApptsResult.results.recordset as Row[];
  const noAppts = Number(noApptsRows[0]?.no_appt_count ?? 0);
  console.log(`  Trustees with no appointments     : ${noAppts}  (subset of skipped)`);

  // -------------------------------------------------------------------------
  // 4. CAMS-772: Archived appointments
  //    STATUS codes C/E/O with a non-null ARCHIVE_DATE → imported as inactive
  // -------------------------------------------------------------------------
  const archiveQuery = `
    SELECT
      STATUS,
      COUNT(*) AS archived_rows,
      COUNT(DISTINCT TRU_ID) AS affected_trustees
    FROM CHAPTER_DETAILS
    WHERE ARCHIVE_DATE IS NOT NULL
      AND STATUS IN ('C', 'E', 'O')
    GROUP BY STATUS
    ORDER BY STATUS
  `;
  const archiveResult = await gateway.executeQuery(context, archiveQuery, []);
  const archiveRows = archiveResult.results.recordset as Row[];

  console.log('\nCAMS-772: Archived appointments (ARCHIVE_DATE non-null for C/E/O):');
  console.log('─'.repeat(55));
  if (archiveRows.length === 0) {
    console.log('  (none found — ARCHIVE_DATE column may be missing or empty)');
  } else {
    for (const row of archiveRows) {
      const label = ARCHIVE_STATUS_LABELS[String(row.STATUS)] ?? String(row.STATUS);
      console.log(
        `  STATUS=${row.STATUS} (${label}): ${row.archived_rows} rows, ${row.affected_trustees} trustees → imported as inactive`,
      );
    }

    const totalAffectedQuery = `
      SELECT COUNT(DISTINCT TRU_ID) AS total
      FROM CHAPTER_DETAILS
      WHERE ARCHIVE_DATE IS NOT NULL
        AND STATUS IN ('C', 'E', 'O')
    `;
    const totalAffectedResult = await gateway.executeQuery(context, totalAffectedQuery, []);
    const totalAffectedRows = totalAffectedResult.results.recordset as Row[];
    const totalAffected = Number(totalAffectedRows[0]?.total ?? 0);
    console.log(
      `\n  Total trustees affected by CAMS-772 fix : ${totalAffected}`,
    );

    // How many of those still have at least one active appointment (not fully inactive)
    const mixedQuery = `
      SELECT COUNT(DISTINCT T.ID) AS mixed_count
      FROM TRUSTEES T
      WHERE EXISTS (
        SELECT 1 FROM CHAPTER_DETAILS CD
        WHERE CD.TRU_ID = T.ID AND CD.ARCHIVE_DATE IS NOT NULL AND CD.STATUS IN ('C', 'E', 'O')
      )
      AND EXISTS (
        SELECT 1 FROM CHAPTER_DETAILS CD2
        WHERE CD2.TRU_ID = T.ID AND CD2.STATUS IN (${activeCodesInList})
          AND (CD2.ARCHIVE_DATE IS NULL OR CD2.STATUS NOT IN ('C', 'E', 'O'))
      )
    `;
    const mixedResult = await gateway.executeQuery(context, mixedQuery, []);
    const mixedRows = mixedResult.results.recordset as Row[];
    const mixedCount = Number(mixedRows[0]?.mixed_count ?? 0);
    console.log(
      `  Of those, trustees with ≥1 other active appointment (still in list): ${mixedCount}`,
    );
    console.log(
      `  Trustees fully inactive after fix (all active appts were archived) : ${totalAffected - mixedCount}`,
    );
  }

  console.log('\n' + '='.repeat(60));
}

checkActiveStatus().catch(console.error);
