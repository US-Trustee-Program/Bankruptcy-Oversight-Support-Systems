import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { cleanseAndMapAppointment } from './ats-cleansing-pipeline';
import { AtsAppointmentRecord } from '../../../adapters/types/ats.types';
import { CleansingClassification, TrusteeOverride } from './ats-cleansing-types';

// Test-only type that includes DIVISION from TSV export (not used in production)
type TsvAtsAppointmentRecord = AtsAppointmentRecord & {
  DIVISION?: string;
};

const TSV_PATH = path.join(
  __dirname,
  '../../../../../.ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-appointments/brainstorming/trustee_cross_reference_enriched_v4_ts.tsv',
);

const OVERRIDE_TSV_PATH = path.join(
  __dirname,
  '../../../../../.ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-appointments/brainstorming/trustee_appointment_overrides.tsv',
);

type TsvRow = {
  trusteeid: string;
  status: string;
  district: string;
  serving_state: string;
  division: string;
  chapter: string;
  appointed_date: string;
  status_eff_date: string;
  classification: string;
  court_ids: string;
  map_type: string;
  cleansing_notes: string;
};

function parseTsvRow(line: string, headers: string[]): TsvRow {
  const values = line.split('\t');
  const row: Record<string, string | null> = {};
  headers.forEach((header, i) => {
    row[header.toLowerCase()] = values[i] === 'NULL' ? null : values[i];
  });
  return row as TsvRow;
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr === 'NULL') return null;
  return new Date(dateStr);
}

function loadOverrides(): Map<string, TrusteeOverride[]> {
  const overridesMap = new Map<string, TrusteeOverride[]>();

  if (!fs.existsSync(OVERRIDE_TSV_PATH)) {
    return overridesMap;
  }

  const content = fs.readFileSync(OVERRIDE_TSV_PATH, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  const headers = lines[0].split('\t').map((h) => h.toLowerCase());

  lines.slice(1).forEach((line) => {
    const values = line.split('\t');
    const row: Record<string, string | null> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] === 'NULL' ? null : values[i];
    });

    const override: TrusteeOverride = {
      trusteeId: row.trustee_id,
      status: row.status,
      district: row.district,
      state: row.state,
      chapter: row.chapter,
      action: row.action as 'SKIP' | 'MAP',
      overrideStatus: row.override_status,
      overrideDistrict: row.override_district,
      overrideState: row.override_state,
      overrideChapter: row.override_chapter,
      overrideCourtId: row.override_court_id,
      notes: row.notes,
    };

    const existing = overridesMap.get(override.trusteeId) || [];
    existing.push(override);
    overridesMap.set(override.trusteeId, existing);
  });

  return overridesMap;
}

const mockContext = {
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
} as const;

describe('TSV Parity Validation', () => {
  test('should match prototype output for all TSV rows', () => {
    // Load override data
    const overridesCache = loadOverrides();
    console.log(`\nLoaded ${overridesCache.size} trustee overrides`);

    // Read TSV file
    const tsvContent = fs.readFileSync(TSV_PATH, 'utf-8');
    const lines = tsvContent.split('\n').filter((line) => line.trim());
    const headers = lines[0].split('\t').map((h) => h.toLowerCase());
    const dataLines = lines.slice(1);

    console.log(`\nValidating ${dataLines.length} appointments from TSV...\n`);

    const mismatches: Array<{
      row: number;
      trusteeid: string;
      field: string;
      expected: string | string[];
      actual: string | string[];
      notes?: string;
    }> = [];

    let cleanCount = 0;
    let autoRecoverableCount = 0;
    let problematicCount = 0;
    let uncleansableCount = 0;
    let skipCount = 0;

    dataLines.forEach((line, idx) => {
      const row = parseTsvRow(line, headers);
      const rowNum = idx + 2; // +2 because: +1 for 0-index, +1 for header row

      // Build ATS appointment record from TSV (includes DIVISION from export, but not used)
      const atsAppointment: TsvAtsAppointmentRecord = {
        STATUS: row.status,
        DISTRICT: row.district,
        STATE: row.serving_state,
        DIVISION: row.division,
        CHAPTER: row.chapter,
        DATE_APPOINTED: parseDate(row.appointed_date),
        EFFECTIVE_DATE: parseDate(row.status_eff_date),
      };

      // Run through cleansing pipeline
      const result = cleanseAndMapAppointment(
        mockContext,
        row.trusteeid,
        atsAppointment,
        overridesCache,
      );

      // Expected values from TSV (handle both comma and semicolon delimiters)
      const expectedClassification = row.classification;
      const expectedCourtIds = row.court_ids
        ? row.court_ids.split(/[,;]/).map((id) => id.trim())
        : [];
      const expectedMapType = row.map_type;

      // Actual values from TypeScript
      const actualClassification = result.classification;
      const actualCourtIds = result.courtIds || [];
      const actualMapType = result.mapType;

      // Track counts
      switch (actualClassification) {
        case CleansingClassification.CLEAN:
          cleanCount++;
          break;
        case CleansingClassification.AUTO_RECOVERABLE:
          autoRecoverableCount++;
          break;
        case CleansingClassification.PROBLEMATIC:
          problematicCount++;
          break;
        case CleansingClassification.UNCLEANSABLE:
          uncleansableCount++;
          break;
        case CleansingClassification.SKIP:
          skipCount++;
          break;
      }

      // Compare classification
      if (actualClassification !== expectedClassification) {
        mismatches.push({
          row: rowNum,
          trusteeid: row.trusteeid,
          field: 'classification',
          expected: expectedClassification,
          actual: actualClassification,
          notes: `DISTRICT="${row.district}", STATE="${row.serving_state}"`,
        });
      }

      // Compare court IDs (only for successful cleansing)
      if (expectedClassification === 'CLEAN' || expectedClassification === 'AUTO_RECOVERABLE') {
        const expectedSorted = [...expectedCourtIds].sort();
        const actualSorted = [...actualCourtIds].sort();

        // Only report mismatch if arrays actually differ
        if (
          expectedSorted.length !== actualSorted.length ||
          !expectedSorted.every((val, idx) => val === actualSorted[idx])
        ) {
          mismatches.push({
            row: rowNum,
            trusteeid: row.trusteeid,
            field: 'courtIds',
            expected: expectedSorted.join(';'),
            actual: actualSorted.join(';'),
          });
        }
      }

      // Compare map type
      if (actualMapType !== expectedMapType) {
        mismatches.push({
          row: rowNum,
          trusteeid: row.trusteeid,
          field: 'mapType',
          expected: expectedMapType,
          actual: actualMapType,
        });
      }
    });

    // Print summary
    console.log('\n=== VALIDATION SUMMARY ===');
    console.log(`Total appointments: ${dataLines.length}`);
    console.log(`CLEAN: ${cleanCount} (expected ~5496)`);
    console.log(`AUTO_RECOVERABLE: ${autoRecoverableCount} (expected ~2635)`);
    console.log(`PROBLEMATIC: ${problematicCount} (expected ~80)`);
    console.log(`UNCLEANSABLE: ${uncleansableCount} (expected ~33)`);
    console.log(`SKIP: ${skipCount}`);
    console.log(`\nMismatches: ${mismatches.length}`);

    // Group mismatches by type
    const classificationMismatches = mismatches.filter((m) => m.field === 'classification');
    const courtIdMismatches = mismatches.filter((m) => m.field === 'courtIds');
    const mapTypeMismatches = mismatches.filter((m) => m.field === 'mapType');
    console.log(`  Classification: ${classificationMismatches.length}`);
    console.log(`  CourtIds: ${courtIdMismatches.length}`);
    console.log(`  MapType: ${mapTypeMismatches.length}`);

    if (mismatches.length > 0) {
      console.log('\n=== MISMATCHES ===');
      mismatches.slice(0, 20).forEach((m) => {
        console.log(
          `Row ${m.row} (TRU_ID=${m.trusteeid}): ${m.field} - expected "${m.expected}", got "${m.actual}"${m.notes ? ` - ${m.notes}` : ''}`,
        );
      });
      if (mismatches.length > 20) {
        console.log(`... and ${mismatches.length - 20} more mismatches`);
      }
    }

    // Assertion
    expect(mismatches.length).toBe(0);
  });
});
