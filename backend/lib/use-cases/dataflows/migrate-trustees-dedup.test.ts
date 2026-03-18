import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  getTrusteeDedupeKey,
  deduplicateTrusteesInPage,
  selectPrimaryAddress,
  mergeTrusteeRecords,
  upsertTrustee,
  processPageOfTrustees,
} from './migrate-trustees';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { AtsTrusteeRecord } from '../../adapters/types/ats.types';

describe('Trustee Deduplication', () => {
  let context: ApplicationContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTrusteesRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAppointmentsRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAtsGateway: any;

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockTrusteesRepo = {
      findTrusteeByNameAndState: vi.fn().mockResolvedValue(null),
      createTrustee: vi.fn(),
      updateTrustee: vi.fn(),
    };

    mockAppointmentsRepo = {
      createAppointment: vi.fn(),
      getTrusteeAppointments: vi.fn().mockResolvedValue([]),
    };

    mockAtsGateway = {
      getTrusteeAppointments: vi.fn().mockResolvedValue({
        cleanAppointments: [],
        failedAppointments: [],
        stats: {
          total: 0,
          clean: 0,
          autoRecoverable: 0,
          problematic: 0,
          uncleansable: 0,
          skipped: 0,
        },
      }),
    };

    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(mockTrusteesRepo);
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(mockAppointmentsRepo);
    vi.spyOn(factory, 'getAtsGateway').mockReturnValue(mockAtsGateway);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getTrusteeDedupeKey', () => {
    test('should generate dedup key from normalized name and state', () => {
      const trustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      const key = getTrusteeDedupeKey(trustee);

      expect(key).toBe('John|Doe|NY');
    });

    test('should normalize whitespace in names', () => {
      const trustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: '  John  ',
        LAST_NAME: '  Doe  ',
        STATE: 'NY',
      };

      const key = getTrusteeDedupeKey(trustee);

      expect(key).toBe('John|Doe|NY');
    });

    test('should handle multiple spaces in names', () => {
      const trustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John   Michael',
        LAST_NAME: 'Doe   Smith',
        STATE: 'NY',
      };

      const key = getTrusteeDedupeKey(trustee);

      expect(key).toBe('John Michael|Doe Smith|NY');
    });

    test('should normalize state to uppercase', () => {
      const trustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'ny',
      };

      const key = getTrusteeDedupeKey(trustee);

      expect(key).toBe('John|Doe|NY');
    });

    test('should handle missing first name', () => {
      const trustee: AtsTrusteeRecord = {
        ID: 1,
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      const key = getTrusteeDedupeKey(trustee);

      expect(key).toBe('|Doe|NY');
    });

    test('should handle missing last name', () => {
      const trustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        STATE: 'NY',
      };

      const key = getTrusteeDedupeKey(trustee);

      expect(key).toBe('John||NY');
    });

    test('should handle missing state', () => {
      const trustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
      };

      const key = getTrusteeDedupeKey(trustee);

      expect(key).toBe('John|Doe|');
    });
  });

  describe('deduplicateTrusteesInPage', () => {
    test('should group trustees by dedup key', () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
        { ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith', STATE: 'CA' },
        { ID: 3, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
      ];

      const result = deduplicateTrusteesInPage(trustees);

      expect(result.size).toBe(2);
      expect(result.get('John|Doe|NY')).toHaveLength(2);
      expect(result.get('Jane|Smith|CA')).toHaveLength(1);
    });

    test('should handle empty array', () => {
      const result = deduplicateTrusteesInPage([]);

      expect(result.size).toBe(0);
    });

    test('should handle single trustee', () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
      ];

      const result = deduplicateTrusteesInPage(trustees);

      expect(result.size).toBe(1);
      expect(result.get('John|Doe|NY')).toHaveLength(1);
    });

    test('should deduplicate Gerard McHale Jr. scenario (4 TOD records)', () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 11092, FIRST_NAME: 'Gerard', LAST_NAME: 'McHale Jr.', STATE: 'AK', CITY: 'City1' },
        { ID: 13340, FIRST_NAME: 'Gerard', LAST_NAME: 'McHale Jr.', STATE: 'AK', CITY: 'City2' },
        { ID: 17287, FIRST_NAME: 'Gerard', LAST_NAME: 'McHale Jr.', STATE: 'AK', CITY: 'City3' },
        { ID: 27472, FIRST_NAME: 'Gerard', LAST_NAME: 'McHale Jr.', STATE: 'AK', CITY: 'City4' },
      ];

      const result = deduplicateTrusteesInPage(trustees);

      expect(result.size).toBe(1);
      expect(result.get('Gerard|McHale Jr.|AK')).toHaveLength(4);
    });
  });

  describe('selectPrimaryAddress', () => {
    test('should select record with most complete address', () => {
      const records: AtsTrusteeRecord[] = [
        {
          ID: 1,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
        {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '456 Oak Ave',
          STREET1: 'Suite 100',
          CITY: 'New York',
          STATE: 'NY',
          ZIP: '10001',
          ZIP_PLUS: '1234',
          TELEPHONE: '5551234567',
          EMAIL_ADDRESS: 'john@example.com',
          COMPANY: 'Acme Corp',
        },
      ];

      const result = selectPrimaryAddress(records);

      expect(result.primary.ID).toBe(2); // More complete address
      expect(result.additional).toHaveLength(1);
    });

    test('should return single record with no additional addresses', () => {
      const records: AtsTrusteeRecord[] = [
        {
          ID: 1,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
      ];

      const result = selectPrimaryAddress(records);

      expect(result.primary.ID).toBe(1);
      expect(result.additional).toHaveLength(0);
    });

    test('should include additional addresses with meaningful data', () => {
      const records: AtsTrusteeRecord[] = [
        {
          ID: 1,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '456 Oak Ave',
          CITY: 'Los Angeles',
          STATE: 'CA',
          ZIP: '90001',
        },
        {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
          ZIP: '10001',
        },
      ];

      const result = selectPrimaryAddress(records);

      expect(result.primary.ID).toBe(1); // Same score, lowest ID wins
      expect(result.additional).toHaveLength(1);
      expect(result.additional[0].address1).toBe('123 Main St');
      expect(result.additional[0].cityStateZipCountry).toBe('New York, NY, 10001');
    });

    test('should exclude additional addresses with no meaningful data', () => {
      const records: AtsTrusteeRecord[] = [
        {
          ID: 1,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
        {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          // No address fields
        },
      ];

      const result = selectPrimaryAddress(records);

      expect(result.primary.ID).toBe(1);
      expect(result.additional).toHaveLength(0);
    });

    test('should use ID as tiebreaker when scores are equal', () => {
      const records: AtsTrusteeRecord[] = [
        {
          ID: 3,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '789 Elm St',
          CITY: 'Boston',
          STATE: 'MA',
        },
        {
          ID: 1,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '456 Oak Ave',
          CITY: 'Chicago',
          STATE: 'IL',
        },
        {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
      ];

      const result = selectPrimaryAddress(records);

      expect(result.primary.ID).toBe(1); // Lowest ID when scores are equal
    });

    test('should format additional addresses with ZIP+4', () => {
      const records: AtsTrusteeRecord[] = [
        {
          ID: 1,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '456 Oak Ave',
          CITY: 'Los Angeles',
          STATE: 'CA',
          ZIP: '90001',
          ZIP_PLUS: '5678',
        },
        {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
          ZIP: '10001',
        },
      ];

      const result = selectPrimaryAddress(records);

      expect(result.additional[0].cityStateZipCountry).toBe('New York, NY, 10001');
    });

    test('should throw error for empty array', () => {
      expect(() => selectPrimaryAddress([])).toThrow(
        'Cannot select primary record from empty array',
      );
    });
  });

  describe('mergeTrusteeRecords', () => {
    test('should merge multiple records into single data structure', () => {
      const records: AtsTrusteeRecord[] = [
        {
          ID: 11092,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STREET: '123 Main St',
          CITY: 'Anchorage',
          STATE: 'AK',
          ZIP: '99501',
        },
        {
          ID: 13340,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STREET: '456 Oak Ave',
          STREET1: 'Suite 100',
          CITY: 'Fairbanks',
          STATE: 'AK',
          ZIP: '99701',
          TELEPHONE: '9075551234',
        },
        {
          ID: 17287,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STREET: '789 Elm St',
          CITY: 'Juneau',
          STATE: 'AK',
        },
        {
          ID: 27472,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          CITY: 'Sitka',
          STATE: 'AK',
        },
      ];

      const result = mergeTrusteeRecords(records);

      expect(result.primary.ID).toBe(13340); // Most complete address (highest score)
      expect(result.todIds).toEqual(['11092', '13340', '17287', '27472']);
      expect(result.additionalAddresses.length).toBeGreaterThan(0);
    });

    test('should collect all TOD IDs', () => {
      const records: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
        { ID: 2, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
      ];

      const result = mergeTrusteeRecords(records);

      expect(result.todIds).toEqual(['1', '2']);
    });
  });

  describe('upsertTrustee with deduplication', () => {
    test('should create new trustee with multiple TOD IDs', async () => {
      const mergedData = {
        primary: {
          ID: 11092,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STREET: '123 Main St',
          CITY: 'Anchorage',
          STATE: 'AK',
          ZIP: '99501',
        },
        todIds: ['11092', '13340', '17287', '27472'],
        additionalAddresses: [
          {
            address1: '456 Oak Ave',
            cityStateZipCountry: 'Fairbanks, AK, 99701',
          },
        ],
        allAppointments: [],
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'Gerard McHale Jr.',
        legacy: {
          truIds: ['11092', '13340', '17287', '27472'],
          addresses: [
            {
              address1: '456 Oak Ave',
              cityStateZipCountry: 'Fairbanks, AK, 99701',
            },
          ],
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);

      const result = await upsertTrustee(context, mergedData);

      expect(result.data).toEqual(createdTrustee);
      expect(mockTrusteesRepo.findTrusteeByNameAndState).toHaveBeenCalledWith(
        'Gerard',
        'McHale Jr.',
        'AK',
      );
      expect(mockTrusteesRepo.createTrustee).toHaveBeenCalledWith(
        expect.objectContaining({
          legacy: expect.objectContaining({
            truIds: ['11092', '13340', '17287', '27472'],
          }),
        }),
        expect.anything(),
      );
    });

    test('should merge TOD IDs when trustee exists', async () => {
      const mergedData = {
        primary: {
          ID: 27472,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STREET: '123 Main St',
          CITY: 'Anchorage',
          STATE: 'AK',
        },
        todIds: ['27472'],
        additionalAddresses: [],
        allAppointments: [],
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-123',
        name: 'Gerard McHale Jr.',
        legacy: {
          truIds: ['11092', '13340', '17287'],
        },
      };

      const updatedTrustee = {
        ...existingTrustee,
        legacy: {
          truIds: ['11092', '13340', '17287', '27472'],
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(existingTrustee);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(updatedTrustee);

      const result = await upsertTrustee(context, mergedData);

      expect(result.data).toEqual(updatedTrustee);
      expect(mockTrusteesRepo.updateTrustee).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({
          legacy: expect.objectContaining({
            truIds: ['11092', '13340', '17287', '27472'],
          }),
        }),
        expect.anything(),
      );
    });

    test('should skip trustee with incomplete name or state', async () => {
      const mergedData = {
        primary: {
          ID: 1,
          FIRST_NAME: 'John',
          // Missing LAST_NAME
          STATE: 'NY',
        },
        todIds: ['1'],
        additionalAddresses: [],
        allAppointments: [],
      };

      const result = await upsertTrustee(context, mergedData);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Cannot upsert trustee 1');
      expect(mockTrusteesRepo.findTrusteeByNameAndState).not.toHaveBeenCalled();
    });
  });

  describe('Address Deduplication', () => {
    test('should deduplicate addresses when merging with existing trustee', async () => {
      const mergedData = {
        primary: {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
        todIds: ['2'],
        additionalAddresses: [
          {
            address1: '456 Oak Ave',
            cityStateZipCountry: 'Los Angeles, CA, 90001',
          },
          {
            address1: '123 Main St',
            cityStateZipCountry: 'New York, NY, 10001',
          },
        ],
        allAppointments: [],
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-456',
        name: 'John Doe',
        legacy: {
          truIds: ['1'],
          addresses: [
            {
              address1: '123 Main St',
              cityStateZipCountry: 'New York, NY, 10001',
            },
          ],
        },
      };

      const updatedTrustee = {
        ...existingTrustee,
        legacy: {
          truIds: ['1', '2'],
          addresses: [
            {
              address1: '123 Main St',
              cityStateZipCountry: 'New York, NY, 10001',
            },
            {
              address1: '456 Oak Ave',
              cityStateZipCountry: 'Los Angeles, CA, 90001',
            },
          ],
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(existingTrustee);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(updatedTrustee);

      const result = await upsertTrustee(context, mergedData);

      expect(result.data).toEqual(updatedTrustee);

      // Verify that only the new unique address was added
      const updateCall = mockTrusteesRepo.updateTrustee.mock.calls[0];
      const updatedLegacy = updateCall[1].legacy;
      expect(updatedLegacy.addresses).toHaveLength(2);
      expect(updatedLegacy.addresses[0].address1).toBe('123 Main St');
      expect(updatedLegacy.addresses[1].address1).toBe('456 Oak Ave');
    });

    test('should handle case-insensitive address deduplication', async () => {
      const mergedData = {
        primary: {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
        todIds: ['2'],
        additionalAddresses: [
          {
            address1: '123 MAIN ST',
            cityStateZipCountry: 'NEW YORK, NY, 10001',
          },
        ],
        allAppointments: [],
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-456',
        name: 'John Doe',
        legacy: {
          truIds: ['1'],
          addresses: [
            {
              address1: '123 main st',
              cityStateZipCountry: 'new york, ny, 10001',
            },
          ],
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(existingTrustee);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(existingTrustee);

      const result = await upsertTrustee(context, mergedData);

      expect(result.error).toBeUndefined();

      // Verify that duplicate address was NOT added
      const updateCall = mockTrusteesRepo.updateTrustee.mock.calls[0];
      const updatedLegacy = updateCall[1].legacy;
      expect(updatedLegacy.addresses).toHaveLength(1);
    });

    test('should handle whitespace differences in address deduplication', async () => {
      const mergedData = {
        primary: {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
        todIds: ['2'],
        additionalAddresses: [
          {
            address1: '  123 Main St  ',
            cityStateZipCountry: '  New York, NY, 10001  ',
          },
        ],
        allAppointments: [],
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-456',
        name: 'John Doe',
        legacy: {
          truIds: ['1'],
          addresses: [
            {
              address1: '123 Main St',
              cityStateZipCountry: 'New York, NY, 10001',
            },
          ],
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(existingTrustee);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(existingTrustee);

      const result = await upsertTrustee(context, mergedData);

      expect(result.error).toBeUndefined();

      // Verify that duplicate address was NOT added
      const updateCall = mockTrusteesRepo.updateTrustee.mock.calls[0];
      const updatedLegacy = updateCall[1].legacy;
      expect(updatedLegacy.addresses).toHaveLength(1);
    });

    test('should keep addresses with empty/null fields', async () => {
      const mergedData = {
        primary: {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
        todIds: ['2'],
        additionalAddresses: [
          {
            address1: null,
            cityStateZipCountry: null,
          },
          {
            address1: '',
            cityStateZipCountry: '',
          },
        ],
        allAppointments: [],
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-456',
        name: 'John Doe',
        legacy: {
          truIds: ['1'],
          addresses: [],
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(existingTrustee);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(existingTrustee);

      const result = await upsertTrustee(context, mergedData);

      expect(result.error).toBeUndefined();

      // Verify that addresses with empty keys are kept
      const updateCall = mockTrusteesRepo.updateTrustee.mock.calls[0];
      const updatedLegacy = updateCall[1].legacy;
      expect(updatedLegacy.addresses).toHaveLength(2);
    });

    test('should prevent unbounded growth on re-runs', async () => {
      // Simulate re-running the migration with the same data multiple times
      const mergedData = {
        primary: {
          ID: 2,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
        todIds: ['2'],
        additionalAddresses: [
          {
            address1: '456 Oak Ave',
            cityStateZipCountry: 'Los Angeles, CA, 90001',
          },
          {
            address1: '789 Elm St',
            cityStateZipCountry: 'Chicago, IL, 60601',
          },
        ],
        allAppointments: [],
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-456',
        name: 'John Doe',
        legacy: {
          truIds: ['1'],
          addresses: [
            {
              address1: '456 Oak Ave',
              cityStateZipCountry: 'Los Angeles, CA, 90001',
            },
          ],
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(existingTrustee);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(existingTrustee);

      // First run
      await upsertTrustee(context, mergedData);

      let updateCall = mockTrusteesRepo.updateTrustee.mock.calls[0];
      let updatedLegacy = updateCall[1].legacy;
      expect(updatedLegacy.addresses).toHaveLength(2);

      // Update mock to return the result from first run
      const afterFirstRun = {
        ...existingTrustee,
        legacy: {
          truIds: ['1', '2'],
          addresses: updatedLegacy.addresses,
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(afterFirstRun);

      // Second run (re-run with same data)
      await upsertTrustee(context, mergedData);

      updateCall = mockTrusteesRepo.updateTrustee.mock.calls[1];
      updatedLegacy = updateCall[1].legacy;

      // Verify addresses didn't grow - should still be 2
      expect(updatedLegacy.addresses).toHaveLength(2);
    });

    test('should deduplicate within additionalAddresses array itself', async () => {
      const mergedData = {
        primary: {
          ID: 1,
          FIRST_NAME: 'John',
          LAST_NAME: 'Doe',
          STREET: '123 Main St',
          CITY: 'New York',
          STATE: 'NY',
        },
        todIds: ['1'],
        additionalAddresses: [
          {
            address1: '456 Oak Ave',
            cityStateZipCountry: 'Los Angeles, CA, 90001',
          },
          {
            address1: '456 Oak Ave',
            cityStateZipCountry: 'Los Angeles, CA, 90001',
          },
          {
            address1: '789 Elm St',
            cityStateZipCountry: 'Chicago, IL, 60601',
          },
        ],
        allAppointments: [],
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-456',
        name: 'John Doe',
        legacy: {
          truIds: ['0'],
          addresses: [],
        },
      };

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(existingTrustee);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(existingTrustee);

      const result = await upsertTrustee(context, mergedData);

      expect(result.error).toBeUndefined();

      // Verify that duplicate within additionalAddresses was removed
      const updateCall = mockTrusteesRepo.updateTrustee.mock.calls[0];
      const updatedLegacy = updateCall[1].legacy;
      expect(updatedLegacy.addresses).toHaveLength(2);
      expect(updatedLegacy.addresses[0].address1).toBe('456 Oak Ave');
      expect(updatedLegacy.addresses[1].address1).toBe('789 Elm St');
    });
  });

  describe('processPageOfTrustees with deduplication', () => {
    test('should deduplicate page before processing', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY', STREET: '123 Main St' },
        { ID: 2, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY', STREET: '456 Oak Ave' },
        { ID: 3, FIRST_NAME: 'Jane', LAST_NAME: 'Smith', STATE: 'CA', STREET: '789 Elm St' },
      ];

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue({
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'Test',
      });

      const result = await processPageOfTrustees(context, trustees);

      // Should create 2 unique trustees (John Doe merged, Jane Smith separate)
      expect(result.data?.processed).toBe(2);
      expect(mockTrusteesRepo.createTrustee).toHaveBeenCalledTimes(2);
    });

    test('should handle Gerard McHale Jr. scenario', async () => {
      const trustees: AtsTrusteeRecord[] = [
        {
          ID: 11092,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STATE: 'AK',
          STREET: '123 Main St',
        },
        {
          ID: 13340,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STATE: 'AK',
          STREET: '456 Oak Ave',
        },
        {
          ID: 17287,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STATE: 'AK',
          STREET: '789 Elm St',
        },
        {
          ID: 27472,
          FIRST_NAME: 'Gerard',
          LAST_NAME: 'McHale Jr.',
          STATE: 'AK',
          STREET: '321 Pine Ln',
        },
      ];

      mockTrusteesRepo.findTrusteeByNameAndState.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue({
        id: 'new-id',
        trusteeId: 'trustee-gerard',
        name: 'Gerard McHale Jr.',
        legacy: {
          truIds: ['11092', '13340', '17287', '27472'],
        },
      });

      const result = await processPageOfTrustees(context, trustees);

      // Should create 1 trustee with 4 TOD IDs
      expect(result.data?.processed).toBe(1);
      expect(mockTrusteesRepo.createTrustee).toHaveBeenCalledTimes(1);
      expect(mockTrusteesRepo.createTrustee).toHaveBeenCalledWith(
        expect.objectContaining({
          legacy: expect.objectContaining({
            truIds: ['11092', '13340', '17287', '27472'],
          }),
        }),
        expect.anything(),
      );
    });
  });
});
