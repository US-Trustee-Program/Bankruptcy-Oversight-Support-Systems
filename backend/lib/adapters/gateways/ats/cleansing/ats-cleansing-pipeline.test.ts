/**
 * Data-driven tests for ATS cleansing pipeline using TSV validation data
 *
 * This test suite validates cleansing behavior by testing all 8,244 appointments
 * from the enriched TSV artifact (colocated in test-data/).
 *
 * Tests are organized by classification type (CLEAN, AUTO_RECOVERABLE, PROBLEMATIC,
 * UNCLEANSABLE) for better reporting.
 */

import { describe, test, expect } from 'vitest';
import { CleansingClassification } from './ats-cleansing-types';
import { loadOverrides, loadTsvRows, cleanseRow } from './ats-tsv-test-utils';

describe('ATS Cleansing Pipeline - TSV Validation', () => {
  const overridesCache = loadOverrides();
  const { rows } = loadTsvRows();

  // Group test data by classification
  const testGroups = {
    CLEAN: [] as Array<{
      row: ReturnType<typeof loadTsvRows>['rows'][0];
      rowNum: number;
    }>,
    AUTO_RECOVERABLE: [] as Array<{
      row: ReturnType<typeof loadTsvRows>['rows'][0];
      rowNum: number;
    }>,
    PROBLEMATIC: [] as Array<{
      row: ReturnType<typeof loadTsvRows>['rows'][0];
      rowNum: number;
    }>,
    UNCLEANSABLE: [] as Array<{
      row: ReturnType<typeof loadTsvRows>['rows'][0];
      rowNum: number;
    }>,
  };

  rows.forEach((row, idx) => {
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
        const result = cleanseRow(row, overridesCache);

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
        const result = cleanseRow(row, overridesCache);

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
        const result = cleanseRow(row, overridesCache);

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
        const result = cleanseRow(row, overridesCache);

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
