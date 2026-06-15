/**
 * Automatic data quality validation for ALL scenario files.
 *
 * This test suite validates every scenario file in this directory,
 * ensuring all test data meets quality standards:
 * - Debtors have phoneticTokens
 * - JointDebtors have phoneticTokens
 * - Trustees have phoneticTokens
 * - Phone numbers are in ###-###-#### format
 * - Emails contain @ symbol
 *
 * To add a new scenario to validation, import it below and add to the SCENARIOS array.
 */

import { describe, test, expect, vi } from 'vitest';
import type { SeedContext } from '../../runner.js';
import { validators } from '../lib/test-data-utils.js';

// Mock mssql to prevent real database connections during tests
vi.mock('mssql', () => ({
  default: {
    ConnectionPool: class {
      async connect() {
        return {
          request: () => ({
            input: vi.fn().mockReturnThis(),
            query: vi.fn().mockResolvedValue({ recordset: [] }),
          }),
          close: vi.fn().mockResolvedValue(undefined),
        };
      }
    },
    VarChar: 'VarChar',
  },
}));

// Import all scenario generators
import { generate as generateAdminData } from './admin-data.js';
import { generate as generateCasesFuzzySearch } from './cases-fuzzy-search.js';
import { generate as generateCh11WithTransferOrders } from './ch11-with-transfer-orders.js';
import { generate as generateCh7WithAssignment } from './ch7-with-assignment.js';
import { generate as generateConsolidationScenarios } from './consolidation-scenarios.js';
import { generate as generateDxtrHistoricalTrustees } from './dxtr-historical-trustees.js';
import { generate as generateOversightAssignments } from './oversight-assignments.js';
import { generate as generateTrusteeAssistants } from './trustee-assistants.js';
import { generate as generateTrusteeCaseList } from './trustee-case-list.js';
import { generate as generateTrusteeData } from './trustee-data.js';
import { generate as generateTrusteeFuzzySearch } from './trustee-fuzzy-search.js';
import { generate as generateTrusteeKeyDates } from './trustee-key-dates.js';
import { generate as generateTrusteeMatchAllScenarios } from './trustee-match-all-scenarios.js';
import { generate as generateTrusteesComprehensive } from './trustees-comprehensive.js';

// Array of all scenarios to validate
const SCENARIOS = [
  { name: 'admin-data', generate: generateAdminData },
  { name: 'cases-fuzzy-search', generate: generateCasesFuzzySearch },
  { name: 'ch11-with-transfer-orders', generate: generateCh11WithTransferOrders },
  { name: 'ch7-with-assignment', generate: generateCh7WithAssignment },
  { name: 'consolidation-scenarios', generate: generateConsolidationScenarios },
  { name: 'dxtr-historical-trustees', generate: generateDxtrHistoricalTrustees },
  { name: 'oversight-assignments', generate: generateOversightAssignments },
  { name: 'trustee-assistants', generate: generateTrusteeAssistants },
  { name: 'trustee-case-list', generate: generateTrusteeCaseList },
  { name: 'trustee-data', generate: generateTrusteeData },
  { name: 'trustee-fuzzy-search', generate: generateTrusteeFuzzySearch },
  { name: 'trustee-key-dates', generate: generateTrusteeKeyDates },
  { name: 'trustee-match-all-scenarios', generate: generateTrusteeMatchAllScenarios },
  { name: 'trustees-comprehensive', generate: generateTrusteesComprehensive },
];

// Create mock context for scenario generation
const mockContext: SeedContext = {
  generateCaseId: vi.fn().mockResolvedValue({
    caseId: '081-99-99999',
    caseNumber: '99-99999',
    csCaseId: 'MOCK99999',
  }),
};

describe('Data Quality Validation (All Scenarios)', () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.name} meets data quality standards`, async () => {
      // Generate the seed operations
      const ops = await scenario.generate(mockContext);

      // Validate all operations
      const errors = validators.validateAllSeedOperations(ops);

      // If there are errors, fail the test with detailed messages
      if (errors.length > 0) {
        throw new Error(
          `Data quality issues in ${scenario.name}:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
        );
      }

      // Explicitly pass if no errors
      expect(errors).toEqual([]);
    });
  }
});

// Summary test to show how many scenarios we're validating
test('summary: validates all scenario files', () => {
  expect(SCENARIOS.length).toBeGreaterThan(0);
  console.log(`✓ Validating ${SCENARIOS.length} scenario files for data quality`);
});
