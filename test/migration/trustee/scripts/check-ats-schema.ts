/**
 * Check ATS database schema
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/check-ats-schema.ts
 *
 * Checks:
 *   1. TRUSTEES table columns
 *   2. CHAPTER_DETAILS table columns
 *   3. CAMS-772: ARCHIVE_DATE column presence and data conditions
 *      - Verifies ARCHIVE_DATE exists with the expected type
 *      - Counts rows where ARCHIVE_DATE is non-null for the three affected STATUS codes
 *        (C=case-by-case, E=elected, O=converted-case)
 *      - Shows how many distinct trustees are affected
 *      - Samples a few archived rows so the data can be visually confirmed
 */

import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import factory from '../../../../backend/lib/factory';
import { ARCHIVE_STATUS_LABELS } from './shared';

// Load environment variables
dotenv.config({ path: 'backend/.env' });

type Row = Record<string, string | number | null | Date>;

function recordset(result: { results: void | object }): Row[] {
  return ((result.results as { recordset: Row[] })?.recordset) ?? [];
}

async function checkSchema() {
  console.log('Checking ATS database schema...\n');

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const gateway = factory.getAtsGateway(context);

  try {
    // -------------------------------------------------------------------------
    // 1. TRUSTEES table columns
    // -------------------------------------------------------------------------
    const trusteesSchemaQuery = `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'TRUSTEES'
      ORDER BY ORDINAL_POSITION
    `;

    const trusteesResult = await gateway.executeQuery(context, trusteesSchemaQuery, []);
    const trusteesRows = recordset(trusteesResult);

    console.log('TRUSTEES table columns:');
    console.log('========================');
    for (const col of trusteesRows) {
      const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  ${String(col.COLUMN_NAME).padEnd(30)} ${col.DATA_TYPE}${maxLen} ${nullable}`);
    }

    // -------------------------------------------------------------------------
    // 2. CHAPTER_DETAILS table columns
    // -------------------------------------------------------------------------
    const chapterSchemaQuery = `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'CHAPTER_DETAILS'
      ORDER BY ORDINAL_POSITION
    `;

    const chapterResult = await gateway.executeQuery(context, chapterSchemaQuery, []);
    const chapterRows = recordset(chapterResult);

    if (chapterRows.length > 0) {
      console.log('\nCHAPTER_DETAILS table columns:');
      console.log('================================');
      for (const col of chapterRows) {
        const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(
          `  ${String(col.COLUMN_NAME).padEnd(30)} ${col.DATA_TYPE}${maxLen} ${nullable}`,
        );
      }
    }

    // -------------------------------------------------------------------------
    // 3. CAMS-772: ARCHIVE_DATE verification
    //
    // TOD archived case-by-case (C), elected (E), and converted-case (O)
    // appointments by setting ARCHIVE_DATE instead of changing STATUS. The
    // migration fix reads ARCHIVE_DATE and overrides status to 'inactive' for
    // those three types. This section confirms the column exists and shows the
    // scope of affected data.
    // -------------------------------------------------------------------------
    console.log('\n\nCAMS-772: ARCHIVE_DATE verification');
    console.log('=====================================');

    // 3a. Confirm ARCHIVE_DATE column exists
    const archiveDateColQuery = `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'CHAPTER_DETAILS'
        AND COLUMN_NAME = 'ARCHIVE_DATE'
    `;
    const archiveDateColResult = await gateway.executeQuery(context, archiveDateColQuery, []);
    const archiveDateCols = recordset(archiveDateColResult);

    if (archiveDateCols.length === 0) {
      console.log('  ❌ ARCHIVE_DATE column NOT FOUND in CHAPTER_DETAILS');
      console.log('     The CAMS-772 fix will not have data to act on until this column exists.');
    } else {
      const col = archiveDateCols[0];
      console.log(
        `  ✅ ARCHIVE_DATE column found: ${col.DATA_TYPE}, IS_NULLABLE=${col.IS_NULLABLE}`,
      );
    }

    // 3b. Count rows with non-null ARCHIVE_DATE by STATUS code
    //     STATUS codes affected: C (case-by-case), E (elected), O (converted-case)
    const archiveCountQuery = `
      SELECT
        STATUS,
        COUNT(*) AS row_count,
        COUNT(DISTINCT TRU_ID) AS trustee_count,
        MIN(ARCHIVE_DATE) AS earliest_archive,
        MAX(ARCHIVE_DATE) AS latest_archive
      FROM CHAPTER_DETAILS
      WHERE ARCHIVE_DATE IS NOT NULL
        AND STATUS IN ('C', 'E', 'O')
      GROUP BY STATUS
      ORDER BY STATUS
    `;
    const archiveCountResult = await gateway.executeQuery(context, archiveCountQuery, []);
    const archiveCounts = recordset(archiveCountResult);

    console.log('\n  Rows with non-null ARCHIVE_DATE (the three affected STATUS codes):');
    if (archiveCounts.length === 0) {
      console.log('  (none found — either no archived appointments or ARCHIVE_DATE column missing)');
    } else {
      for (const row of archiveCounts) {
        const label = ARCHIVE_STATUS_LABELS[String(row.STATUS)] ?? String(row.STATUS);
        const earliest =
          row.earliest_archive instanceof Date
            ? row.earliest_archive.toISOString().split('T')[0]
            : String(row.earliest_archive ?? 'N/A');
        const latest =
          row.latest_archive instanceof Date
            ? row.latest_archive.toISOString().split('T')[0]
            : String(row.latest_archive ?? 'N/A');
        console.log(
          `    STATUS=${row.STATUS} (${label}): ${row.row_count} rows, ${row.trustee_count} trustees, range ${earliest} – ${latest}`,
        );
      }
    }

    // 3c. Total distinct trustees affected
    const affectedTrusteesQuery = `
      SELECT COUNT(DISTINCT TRU_ID) AS affected_trustees
      FROM CHAPTER_DETAILS
      WHERE ARCHIVE_DATE IS NOT NULL
        AND STATUS IN ('C', 'E', 'O')
    `;
    const affectedResult = await gateway.executeQuery(context, affectedTrusteesQuery, []);
    const affectedRows = recordset(affectedResult);
    const affectedCount = affectedRows[0]?.affected_trustees ?? 0;
    console.log(`\n  Total distinct trustees with at least one archived appointment: ${affectedCount}`);

    // 3d. Sample archived rows (up to 5) so data can be visually confirmed
    const sampleArchivedQuery = `
      SELECT TOP 5
        TRU_ID,
        DISTRICT,
        CHAPTER,
        STATUS,
        APPOINTED_DATE,
        STATUS_EFF_DATE,
        ARCHIVE_DATE
      FROM CHAPTER_DETAILS
      WHERE ARCHIVE_DATE IS NOT NULL
        AND STATUS IN ('C', 'E', 'O')
      ORDER BY ARCHIVE_DATE DESC
    `;
    const sampleArchivedResult = await gateway.executeQuery(context, sampleArchivedQuery, []);
    const sampleArchivedRows = recordset(sampleArchivedResult);

    if (sampleArchivedRows.length > 0) {
      console.log('\n  Sample archived rows (newest ARCHIVE_DATE first):');
      for (const row of sampleArchivedRows) {
        const archiveDate =
          row.ARCHIVE_DATE instanceof Date
            ? row.ARCHIVE_DATE.toISOString().split('T')[0]
            : String(row.ARCHIVE_DATE ?? 'N/A');
        const appointedDate =
          row.APPOINTED_DATE instanceof Date
            ? row.APPOINTED_DATE.toISOString().split('T')[0]
            : String(row.APPOINTED_DATE ?? 'N/A');
        const label = ARCHIVE_STATUS_LABELS[String(row.STATUS)] ?? String(row.STATUS);
        console.log(
          `    TRU_ID=${row.TRU_ID}  DISTRICT=${row.DISTRICT}  CHAPTER=${row.CHAPTER}  STATUS=${row.STATUS} (${label})  appointed=${appointedDate}  archived=${archiveDate}`,
        );
      }
    }

    // 3e. Sanity check: rows where ARCHIVE_DATE is set but STATUS is NOT one of the three
    //     (shouldn't be many — just verifying TOD's archiving convention held)
    const unexpectedArchiveQuery = `
      SELECT
        STATUS,
        COUNT(*) AS row_count
      FROM CHAPTER_DETAILS
      WHERE ARCHIVE_DATE IS NOT NULL
        AND STATUS NOT IN ('C', 'E', 'O')
      GROUP BY STATUS
      ORDER BY row_count DESC
    `;
    const unexpectedResult = await gateway.executeQuery(context, unexpectedArchiveQuery, []);
    const unexpectedRows = recordset(unexpectedResult);

    if (unexpectedRows.length > 0) {
      console.log(
        '\n  ⚠️  Rows with ARCHIVE_DATE set but STATUS outside {C, E, O} — NOT overridden by the fix:',
      );
      for (const row of unexpectedRows) {
        console.log(`    STATUS=${row.STATUS}: ${row.row_count} rows`);
      }
    } else {
      console.log('\n  ✅ No unexpected STATUS codes with ARCHIVE_DATE — convention held.');
    }

    // -------------------------------------------------------------------------
    // 4. Sample TRUSTEES row
    // -------------------------------------------------------------------------
    console.log('\n\nSample TRUSTEES row:');
    console.log('=====================');
    const sampleQuery = `SELECT TOP 1 * FROM TRUSTEES`;
    const sampleResult = await gateway.executeQuery(context, sampleQuery, []);
    const sampleRows = recordset(sampleResult);

    if (sampleRows.length > 0) {
      const sample = sampleRows[0];
      for (const [key, value] of Object.entries(sample)) {
        if (value !== null && value !== undefined) {
          console.log(`  ${key}: ${value}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema().catch(console.error);
