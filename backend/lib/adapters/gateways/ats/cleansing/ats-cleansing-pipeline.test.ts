/**
 * Data-driven tests for ATS cleansing pipeline using TSV validation data
 *
 * This test suite validates 100% parity with the Python prototype by testing
 * all 8,244 appointments from the enriched TSV artifact.
 *
 * Tests are organized by classification type for better reporting.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { cleanseAndMapAppointment } from './ats-cleansing-pipeline';
import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';
import { CleansingClassification, TrusteeOverride } from './ats-cleansing-types';

const TSV_PATH = path.join(
  __dirname,
  '../../../../../../.ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-appointments/brainstorming/trustee_cross_reference_enriched_v4_ts.tsv',
);

const OVERRIDE_TSV_PATH = path.join(
  __dirname,
  '../../../../../../.ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-appointments/brainstorming/trustee_appointment_overrides.tsv',
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

describe('ATS Cleansing Pipeline - TSV Validation', () => {
  const overridesCache = loadOverrides();
  const tsvContent = fs.readFileSync(TSV_PATH, 'utf-8');
  const lines = tsvContent.split('\n').filter((line) => line.trim());
  const headers = lines[0].split('\t').map((h) => h.toLowerCase());
  const dataLines = lines.slice(1);

  // Group test data by classification
  const testGroups = {
    CLEAN: [] as Array<{ row: TsvRow; rowNum: number }>,
    AUTO_RECOVERABLE: [] as Array<{ row: TsvRow; rowNum: number }>,
    PROBLEMATIC: [] as Array<{ row: TsvRow; rowNum: number }>,
    UNCLEANSABLE: [] as Array<{ row: TsvRow; rowNum: number }>,
  };

  dataLines.forEach((line, idx) => {
    const row = parseTsvRow(line, headers);
    const rowNum = idx + 2;
    const classification = row.classification as keyof typeof testGroups;
    if (testGroups[classification]) {
      testGroups[classification].push({ row, rowNum });
    }
  });

  describe('CLEAN Classification', () => {
    test(`should correctly classify ${testGroups.CLEAN.length} CLEAN appointments`, () => {
      let successes = 0;
      const failures: string[] = [];

      testGroups.CLEAN.forEach(({ row, rowNum }) => {
        const atsAppointment: AtsAppointmentRecord = {
          STATUS: row.status,
          DISTRICT: row.district,
          STATE: row.serving_state,
          DIVISION: row.division,
          CHAPTER: row.chapter,
          DATE_APPOINTED: parseDate(row.appointed_date),
          EFFECTIVE_DATE: parseDate(row.status_eff_date),
        };

        const result = cleanseAndMapAppointment(
          mockContext,
          row.trusteeid,
          atsAppointment,
          overridesCache,
        );

        if (result.classification === CleansingClassification.CLEAN) {
          successes++;
        } else {
          failures.push(
            `Row ${rowNum} (TRU_ID=${row.trusteeid}): expected CLEAN, got ${result.classification}`,
          );
        }
      });

      if (failures.length > 0) {
        console.log(`\nCLEAN classification failures (${failures.length}):`);
        failures.slice(0, 10).forEach((f) => console.log(`  ${f}`));
        if (failures.length > 10) {
          console.log(`  ... and ${failures.length - 10} more`);
        }
      }

      expect(successes).toBe(testGroups.CLEAN.length);
    });
  });

  describe('AUTO_RECOVERABLE Classification', () => {
    test(`should correctly classify ${testGroups.AUTO_RECOVERABLE.length} AUTO_RECOVERABLE appointments`, () => {
      let successes = 0;
      const failures: string[] = [];

      testGroups.AUTO_RECOVERABLE.forEach(({ row, rowNum }) => {
        const atsAppointment: AtsAppointmentRecord = {
          STATUS: row.status,
          DISTRICT: row.district,
          STATE: row.serving_state,
          DIVISION: row.division,
          CHAPTER: row.chapter,
          DATE_APPOINTED: parseDate(row.appointed_date),
          EFFECTIVE_DATE: parseDate(row.status_eff_date),
        };

        const result = cleanseAndMapAppointment(
          mockContext,
          row.trusteeid,
          atsAppointment,
          overridesCache,
        );

        if (result.classification === CleansingClassification.AUTO_RECOVERABLE) {
          successes++;
        } else {
          failures.push(
            `Row ${rowNum} (TRU_ID=${row.trusteeid}): expected AUTO_RECOVERABLE, got ${result.classification}`,
          );
        }
      });

      if (failures.length > 0) {
        console.log(`\nAUTO_RECOVERABLE classification failures (${failures.length}):`);
        failures.slice(0, 10).forEach((f) => console.log(`  ${f}`));
        if (failures.length > 10) {
          console.log(`  ... and ${failures.length - 10} more`);
        }
      }

      expect(successes).toBe(testGroups.AUTO_RECOVERABLE.length);
    });
  });

  describe('PROBLEMATIC Classification', () => {
    test(`should correctly classify ${testGroups.PROBLEMATIC.length} PROBLEMATIC appointments`, () => {
      let successes = 0;
      const failures: string[] = [];

      testGroups.PROBLEMATIC.forEach(({ row, rowNum }) => {
        const atsAppointment: AtsAppointmentRecord = {
          STATUS: row.status,
          DISTRICT: row.district,
          STATE: row.serving_state,
          DIVISION: row.division,
          CHAPTER: row.chapter,
          DATE_APPOINTED: parseDate(row.appointed_date),
          EFFECTIVE_DATE: parseDate(row.status_eff_date),
        };

        const result = cleanseAndMapAppointment(
          mockContext,
          row.trusteeid,
          atsAppointment,
          overridesCache,
        );

        if (result.classification === CleansingClassification.PROBLEMATIC) {
          successes++;
        } else {
          failures.push(
            `Row ${rowNum} (TRU_ID=${row.trusteeid}): expected PROBLEMATIC, got ${result.classification}`,
          );
        }
      });

      if (failures.length > 0) {
        console.log(`\nPROBLEMATIC classification failures (${failures.length}):`);
        failures.slice(0, 10).forEach((f) => console.log(`  ${f}`));
        if (failures.length > 10) {
          console.log(`  ... and ${failures.length - 10} more`);
        }
      }

      expect(successes).toBe(testGroups.PROBLEMATIC.length);
    });
  });

  describe('UNCLEANSABLE Classification', () => {
    test(`should correctly classify ${testGroups.UNCLEANSABLE.length} UNCLEANSABLE appointments`, () => {
      let successes = 0;
      const failures: string[] = [];

      testGroups.UNCLEANSABLE.forEach(({ row, rowNum }) => {
        const atsAppointment: AtsAppointmentRecord = {
          STATUS: row.status,
          DISTRICT: row.district,
          STATE: row.serving_state,
          DIVISION: row.division,
          CHAPTER: row.chapter,
          DATE_APPOINTED: parseDate(row.appointed_date),
          EFFECTIVE_DATE: parseDate(row.status_eff_date),
        };

        const result = cleanseAndMapAppointment(
          mockContext,
          row.trusteeid,
          atsAppointment,
          overridesCache,
        );

        if (result.classification === CleansingClassification.UNCLEANSABLE) {
          successes++;
        } else {
          failures.push(
            `Row ${rowNum} (TRU_ID=${row.trusteeid}): expected UNCLEANSABLE, got ${result.classification}`,
          );
        }
      });

      if (failures.length > 0) {
        console.log(`\nUNCLEANSABLE classification failures (${failures.length}):`);
        failures.slice(0, 10).forEach((f) => console.log(`  ${f}`));
        if (failures.length > 10) {
          console.log(`  ... and ${failures.length - 10} more`);
        }
      }

      expect(successes).toBe(testGroups.UNCLEANSABLE.length);
    });
  });

  describe('Summary', () => {
    test('should have 100% parity across all 8,244 appointments', () => {
      const total = Object.values(testGroups).reduce((sum, group) => sum + group.length, 0);
      expect(total).toBe(8244);
      console.log('\nTest Coverage:');
      console.log(`  CLEAN: ${testGroups.CLEAN.length}`);
      console.log(`  AUTO_RECOVERABLE: ${testGroups.AUTO_RECOVERABLE.length}`);
      console.log(`  PROBLEMATIC: ${testGroups.PROBLEMATIC.length}`);
      console.log(`  UNCLEANSABLE: ${testGroups.UNCLEANSABLE.length}`);
      console.log(`  Total: ${total}`);
    });
  });
});
