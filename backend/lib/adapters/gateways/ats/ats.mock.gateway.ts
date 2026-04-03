import { ApplicationContext } from '../../types/basic';
import { AtsGateway } from '../../../use-cases/gateways.types';
import {
  AtsTrusteeRecord,
  AtsAppointmentRecord,
  TrusteeAppointmentsResult,
} from '../../types/ats.types';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { DbTableFieldSpec, QueryResults } from '../../types/database';

const MODULE_NAME = 'ATS-MOCK-GATEWAY';

/**
 * IDs of all mock trustees in the pool.
 * Trustee 6 exists but has only inactive appointments (see MOCK_ACTIVE_TRUSTEE_IDS).
 */
const MOCK_TRUSTEE_IDS = [1, 2, 3, 4, 5, 6];

// IDs of mock trustees that have at least one active appointment (simulates WHERE EXISTS filter).
// Trustee 6 has only inactive appointments and is intentionally excluded.
const MOCK_ACTIVE_TRUSTEE_IDS = new Set(MOCK_TRUSTEE_IDS.filter((id) => id !== 6));

/**
 * Total number of mock trustees in the pool (used for pagination).
 * Derived from MOCK_TRUSTEE_IDS to avoid drifting out of sync with filters.
 */
const MOCK_TOTAL_TRUSTEES = MOCK_TRUSTEE_IDS.length;

/**
 * Mock implementation of ATS gateway for testing.
 * Returns sample trustee and appointment data.
 */
export class MockAtsGateway implements AtsGateway {
  private static instance: MockAtsGateway;

  private constructor() {}

  static getInstance(): MockAtsGateway {
    if (!this.instance) {
      this.instance = new MockAtsGateway();
    }
    return this.instance;
  }

  async getTrusteesPage(
    context: ApplicationContext,
    lastTrusteeId: number | null,
    pageSize: number,
  ): Promise<AtsTrusteeRecord[]> {
    context.logger.debug(
      MODULE_NAME,
      `Mock: Getting trustees page with lastId: ${lastTrusteeId}, pageSize: ${pageSize}`,
    );

    // Return only active mock trustees (simulates WHERE EXISTS on CHAPTER_DETAILS active STATUS).
    // Trustee 6 exists in the pool but has only inactive appointments and is excluded.
    const mockTrustees: AtsTrusteeRecord[] = [];
    const startId = lastTrusteeId ? lastTrusteeId + 1 : 1;

    for (let i = startId; i <= MOCK_TOTAL_TRUSTEES && mockTrustees.length < pageSize; i++) {
      if (!MOCK_ACTIVE_TRUSTEE_IDS.has(i)) continue;
      mockTrustees.push({
        ID: i,
        LAST_NAME: `LastName${i}`,
        FIRST_NAME: `FirstName${i}`,
        MIDDLE: `M${i}`,
        COMPANY: i % 2 === 0 ? `Company ${i}` : undefined,
        STREET: `${i * 100} Main Street`,
        STREET1: i % 3 === 0 ? `Suite ${i}` : undefined,
        STREET_A2: undefined,
        CITY: 'New York',
        STATE: 'NY',
        ZIP: `1000${i}`,
        TELEPHONE: `555-000${i}`,
        EMAIL_ADDRESS: `trustee${i}@example.com`,
      });
    }

    return mockTrustees;
  }

  /**
   * Get mock appointments for a trustee.
   * Returns both clean appointments (for storage) and failed appointments (for DLQ).
   *
   * Returns varied data based on trusteeId to test different mapping scenarios:
   *
   * Trustee 1: Standard letter codes (PA) + 12CBC with numeric status
   * Trustee 2: New letter codes (NP, PI, O, E)
   * Trustee 3: Chapter 11 subchapter-v (V, VR)
   * Trustee 4: All numeric codes (1, 3, 5, 6, 7, 8, 9, 10, 12)
   * Trustee 5: CBC chapter variants (12CBC and 13CBC with all status codes)
   * Other: Default basic appointments (PA, S)
   */
  async getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: number,
  ): Promise<TrusteeAppointmentsResult> {
    context.logger.debug(MODULE_NAME, `Mock: Getting appointments for trustee ${trusteeId}`);

    // Return varied mock appointments for testing different mappings
    const mockAppointments: AtsAppointmentRecord[] = [];

    // Trustee 1: Standard letter codes + 12CBC
    if (trusteeId === 1) {
      mockAppointments.push(
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '7',
          DATE_APPOINTED: new Date('2023-01-15'),
          STATUS: 'PA', // panel, active
          EFFECTIVE_DATE: new Date('2023-01-15'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '12CBC',
          DATE_APPOINTED: new Date('2023-03-01'),
          STATUS: '1', // CBC: case-by-case, active
          EFFECTIVE_DATE: new Date('2023-03-01'),
        },
      );
    }

    // Trustee 2: New letter codes (NP, VR, V, PI, O, E)
    if (trusteeId === 2) {
      mockAppointments.push(
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '7',
          DATE_APPOINTED: new Date('2023-02-01'),
          STATUS: 'NP', // off-panel, resigned
          EFFECTIVE_DATE: new Date('2023-02-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '7',
          DATE_APPOINTED: new Date('2023-03-01'),
          STATUS: 'PI', // panel, voluntarily-suspended
          EFFECTIVE_DATE: new Date('2023-03-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '7',
          DATE_APPOINTED: new Date('2023-04-01'),
          STATUS: 'O', // converted-case, active
          EFFECTIVE_DATE: new Date('2023-04-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '7',
          DATE_APPOINTED: new Date('2023-05-01'),
          STATUS: 'E', // elected, active
          EFFECTIVE_DATE: new Date('2023-05-01'),
        },
      );
    }

    // Trustee 3: Chapter 11 subchapter-v (V and VR)
    if (trusteeId === 3) {
      mockAppointments.push(
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '11',
          DATE_APPOINTED: new Date('2023-06-01'),
          STATUS: 'V', // pool, active (11-subchapter-v)
          EFFECTIVE_DATE: new Date('2023-06-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '11',
          DATE_APPOINTED: new Date('2023-07-01'),
          STATUS: 'VR', // out-of-pool, resigned (11-subchapter-v)
          EFFECTIVE_DATE: new Date('2023-07-01'),
        },
      );
    }

    // Trustee 4: Numeric codes (1, 3, 5, 6, 7, 8, 9, 10, 12)
    if (trusteeId === 4) {
      mockAppointments.push(
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '11',
          DATE_APPOINTED: new Date('2023-01-01'),
          STATUS: '1', // case-by-case, active
          EFFECTIVE_DATE: new Date('2023-01-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '12',
          DATE_APPOINTED: new Date('2023-02-01'),
          STATUS: '3', // standing, resigned
          EFFECTIVE_DATE: new Date('2023-02-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '13',
          DATE_APPOINTED: new Date('2023-03-01'),
          STATUS: '5', // standing, terminated
          EFFECTIVE_DATE: new Date('2023-03-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '13',
          DATE_APPOINTED: new Date('2023-04-01'),
          STATUS: '6', // standing, terminated
          EFFECTIVE_DATE: new Date('2023-04-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '12',
          DATE_APPOINTED: new Date('2023-05-01'),
          STATUS: '7', // standing, deceased
          EFFECTIVE_DATE: new Date('2023-05-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '11',
          DATE_APPOINTED: new Date('2023-06-01'),
          STATUS: '8', // case-by-case, active
          EFFECTIVE_DATE: new Date('2023-06-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '11',
          DATE_APPOINTED: new Date('2023-07-01'),
          STATUS: '9', // case-by-case, inactive
          EFFECTIVE_DATE: new Date('2023-07-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '11',
          DATE_APPOINTED: new Date('2023-08-01'),
          STATUS: '10', // case-by-case, inactive
          EFFECTIVE_DATE: new Date('2023-08-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '11',
          DATE_APPOINTED: new Date('2023-09-01'),
          STATUS: '12', // case-by-case, active
          EFFECTIVE_DATE: new Date('2023-09-01'),
        },
      );
    }

    // Trustee 5: CBC chapter variants (12CBC and 13CBC)
    if (trusteeId === 5) {
      mockAppointments.push(
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '12CBC',
          DATE_APPOINTED: new Date('2023-01-01'),
          STATUS: '1', // CBC: case-by-case, active
          EFFECTIVE_DATE: new Date('2023-01-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '12CBC',
          DATE_APPOINTED: new Date('2023-02-01'),
          STATUS: '2', // CBC: case-by-case, active
          EFFECTIVE_DATE: new Date('2023-02-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '12CBC',
          DATE_APPOINTED: new Date('2023-03-01'),
          STATUS: '3', // CBC: case-by-case, inactive
          EFFECTIVE_DATE: new Date('2023-03-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '12CBC',
          DATE_APPOINTED: new Date('2023-04-01'),
          STATUS: '5', // CBC: case-by-case, inactive
          EFFECTIVE_DATE: new Date('2023-04-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '12CBC',
          DATE_APPOINTED: new Date('2023-05-01'),
          STATUS: '7', // CBC: case-by-case, inactive
          EFFECTIVE_DATE: new Date('2023-05-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '13CBC',
          DATE_APPOINTED: new Date('2023-06-01'),
          STATUS: '1', // CBC: case-by-case, active
          EFFECTIVE_DATE: new Date('2023-06-01'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '13CBC',
          DATE_APPOINTED: new Date('2023-07-01'),
          STATUS: '3', // CBC: case-by-case, inactive
          EFFECTIVE_DATE: new Date('2023-07-01'),
        },
      );
    }

    // Trustee 6: Only inactive appointments — excluded from active filter
    if (trusteeId === 6) {
      mockAppointments.push({
        TRU_ID: trusteeId,
        DISTRICT: '02',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2020-01-01'),
        STATUS: 'NP', // off-panel, resigned — not in ACTIVE_STATUS_CODES
        EFFECTIVE_DATE: new Date('2020-01-01'),
      });
    }

    // Default: Return basic appointments for any other trustee ID
    if (mockAppointments.length === 0) {
      mockAppointments.push(
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '7',
          DATE_APPOINTED: new Date('2023-01-15'),
          STATUS: 'PA', // panel, active
          EFFECTIVE_DATE: new Date('2023-01-15'),
        },
        {
          TRU_ID: trusteeId,
          DISTRICT: '02',
          CHAPTER: '13',
          DATE_APPOINTED: new Date('2023-06-01'),
          STATUS: 'S', // standing, active
          EFFECTIVE_DATE: new Date('2023-06-01'),
        },
      );
    }

    // Mock gateway returns raw ATS appointments as cleanAppointments
    // In reality, these would be cleansed TrusteeAppointmentInput[], but for mock purposes
    // we return raw records and let the consumer handle transformation if needed
    return {
      cleanAppointments: mockAppointments as unknown as TrusteeAppointmentInput[], // Mock simplification
      failedAppointments: [], // Mocks typically don't have failures
      stats: {
        total: mockAppointments.length,
        clean: mockAppointments.length,
        autoRecoverable: 0,
        problematic: 0,
        uncleansable: 0,
        skipped: 0,
      },
    };
  }

  async getTrusteeCount(context: ApplicationContext): Promise<number> {
    context.logger.debug(MODULE_NAME, 'Mock: Getting trustee count');
    return MOCK_ACTIVE_TRUSTEE_IDS.size; // Active trustees only (excludes inactive trustee 6)
  }

  async testConnection(context: ApplicationContext): Promise<boolean> {
    context.logger.debug(MODULE_NAME, 'Mock: Testing connection');
    return true; // Mock always succeeds
  }

  async executeQuery(
    context: ApplicationContext,
    _query: string,
    _input?: DbTableFieldSpec[],
  ): Promise<QueryResults> {
    context.logger.warn(
      MODULE_NAME,
      'Mock: executeQuery called but not implemented in MockAtsGateway',
    );
    throw new Error(
      'MockAtsGateway.executeQuery() is not implemented. Use a spy to mock this method in tests if needed.',
    );
  }
}
