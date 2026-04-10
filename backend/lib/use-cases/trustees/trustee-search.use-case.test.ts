import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TrusteeSearchUseCase } from './trustee-search.use-case';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { Trustee } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';

describe('TrusteeSearchUseCase', () => {
  let context: ApplicationContext;

  const mockTrustee1: Partial<Trustee> = {
    id: 'doc-1',
    trusteeId: 'trustee-001',
    name: 'John Smith',
    public: {
      address: {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: { number: '(212) 555-0100' },
      email: 'john.smith@example.com',
    },
  };

  const mockTrustee2: Partial<Trustee> = {
    id: 'doc-2',
    trusteeId: 'trustee-002',
    name: 'Jane Smithson',
    public: {
      address: {
        address1: '456 Oak Ave',
        city: 'Boston',
        state: 'MA',
        zipCode: '02101',
        countryCode: 'US',
      },
      email: 'jane.smithson@example.com',
    },
  };

  const mockTrustee3: Partial<Trustee> = {
    id: 'doc-3',
    trusteeId: 'trustee-003',
    name: 'Jon Smythe',
    public: {
      address: {
        address1: '789 Pine Rd',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        countryCode: 'US',
      },
      email: 'jon.smythe@example.com',
    },
  };

  const mockAppointments1: Partial<TrusteeAppointment>[] = [
    {
      id: 'appt-001',
      trusteeId: 'trustee-001',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '081',
      status: 'active',
      appointedDate: '2020-01-01',
      effectiveDate: '2020-01-01',
    },
  ];

  const mockAppointments2: Partial<TrusteeAppointment>[] = [
    {
      id: 'appt-002',
      trusteeId: 'trustee-002',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '042',
      status: 'active',
      appointedDate: '2021-06-01',
      effectiveDate: '2021-06-01',
    },
  ];

  const mockAppointments3: Partial<TrusteeAppointment>[] = [
    {
      id: 'appt-003',
      trusteeId: 'trustee-003',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '081',
      status: 'active',
      appointedDate: '2022-03-01',
      effectiveDate: '2022-03-01',
    },
  ];

  function setupRepositories(options: {
    exactResults?: Partial<Trustee>[];
    phoneticResults?: Partial<Trustee>[];
    appointmentsByTrustee?: Map<string, Partial<TrusteeAppointment>[]>;
  }) {
    const { exactResults = [], phoneticResults = [], appointmentsByTrustee = new Map() } = options;

    const searchByNameMock = vi.fn().mockResolvedValue(exactResults);
    const searchByTokensMock = vi.fn().mockResolvedValue(phoneticResults);

    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        searchTrusteesByName: searchByNameMock,
        searchTrusteesByPhoneticTokens: searchByTokensMock,
      }),
    );

    const appointmentsMock = vi.fn().mockImplementation((trusteeId: string) => {
      return Promise.resolve(appointmentsByTrustee.get(trusteeId) ?? []);
    });

    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getTrusteeAppointments: appointmentsMock,
      }),
    );

    return { searchByNameMock, searchByTokensMock, appointmentsMock };
  }

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return exact matches tagged as exact and phonetic matches tagged as phonetic', async () => {
    const appointments = new Map<string, Partial<TrusteeAppointment>[]>();
    appointments.set('trustee-001', mockAppointments1);
    appointments.set('trustee-003', mockAppointments3);

    setupRepositories({
      exactResults: [mockTrustee1],
      phoneticResults: [mockTrustee3],
      appointmentsByTrustee: appointments,
    });

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'smith');

    expect(results).toHaveLength(2);
    expect(results[0].trusteeId).toBe('trustee-001');
    expect(results[0].matchType).toBe('exact');
    expect(results[1].trusteeId).toBe('trustee-003');
    expect(results[1].matchType).toBe('phonetic');
  });

  test('should deduplicate trustees found by both exact and phonetic search, keeping exact tag', async () => {
    const appointments = new Map<string, Partial<TrusteeAppointment>[]>();
    appointments.set('trustee-001', mockAppointments1);

    setupRepositories({
      exactResults: [mockTrustee1],
      phoneticResults: [mockTrustee1], // same trustee found by both
      appointmentsByTrustee: appointments,
    });

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'smith');

    expect(results).toHaveLength(1);
    expect(results[0].trusteeId).toBe('trustee-001');
    expect(results[0].matchType).toBe('exact');
  });

  test('should sort exact matches before phonetic matches', async () => {
    const appointments = new Map<string, Partial<TrusteeAppointment>[]>();
    appointments.set('trustee-001', mockAppointments1);
    appointments.set('trustee-002', mockAppointments2);
    appointments.set('trustee-003', mockAppointments3);

    setupRepositories({
      exactResults: [mockTrustee1, mockTrustee2],
      phoneticResults: [mockTrustee3],
      appointmentsByTrustee: appointments,
    });

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'smith');

    expect(results).toHaveLength(3);
    expect(results[0].matchType).toBe('exact');
    expect(results[1].matchType).toBe('exact');
    expect(results[2].matchType).toBe('phonetic');
  });

  test('should cap results at 25 after merging both phases', async () => {
    const manyExact = Array.from({ length: 20 }, (_, i) => ({
      ...mockTrustee1,
      id: `doc-${i}`,
      trusteeId: `trustee-exact-${i}`,
    }));
    const manyPhonetic = Array.from({ length: 20 }, (_, i) => ({
      ...mockTrustee3,
      id: `doc-phonetic-${i}`,
      trusteeId: `trustee-phonetic-${i}`,
    }));

    setupRepositories({
      exactResults: manyExact,
      phoneticResults: manyPhonetic,
    });

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'smith');

    expect(results).toHaveLength(25);
  });

  test('should filter results by courtId when provided', async () => {
    const appointments = new Map<string, Partial<TrusteeAppointment>[]>();
    appointments.set('trustee-001', mockAppointments1); // courtId: '081'
    appointments.set('trustee-002', mockAppointments2); // courtId: '042'

    setupRepositories({
      exactResults: [mockTrustee1, mockTrustee2],
      appointmentsByTrustee: appointments,
    });

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'smith', '081');

    expect(results).toHaveLength(1);
    expect(results[0].trusteeId).toBe('trustee-001');
  });

  test('should return all results when courtId is not provided', async () => {
    const appointments = new Map<string, Partial<TrusteeAppointment>[]>();
    appointments.set('trustee-001', mockAppointments1);
    appointments.set('trustee-002', mockAppointments2);

    setupRepositories({
      exactResults: [mockTrustee1, mockTrustee2],
      appointmentsByTrustee: appointments,
    });

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'smith');

    expect(results).toHaveLength(2);
  });

  test('should return empty array when no trustees match', async () => {
    setupRepositories({});

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'zzzzz');

    expect(results).toEqual([]);
  });

  test('should log enhanced telemetry on successful search', async () => {
    const appointments = new Map<string, Partial<TrusteeAppointment>[]>();
    appointments.set('trustee-001', mockAppointments1);
    appointments.set('trustee-003', mockAppointments3);

    setupRepositories({
      exactResults: [mockTrustee1],
      phoneticResults: [mockTrustee3],
      appointmentsByTrustee: appointments,
    });

    const completeSpy = vi.spyOn(context.observability, 'completeTrace');

    const useCase = new TrusteeSearchUseCase();
    await useCase.searchTrustees(context, 'smith', '081');

    expect(completeSpy).toHaveBeenCalledWith(
      expect.any(Object),
      'TrusteeManualSearchPerformed',
      expect.objectContaining({
        success: true,
        properties: expect.objectContaining({
          searchQuery: 'smith',
          courtIdFilter: '081',
        }),
        measurements: expect.objectContaining({
          exactMatchCount: expect.any(Number),
          phoneticMatchCount: expect.any(Number),
          totalResultCount: expect.any(Number),
        }),
      }),
    );
  });

  test('should log telemetry with courtIdFilter as none when no court filter', async () => {
    setupRepositories({ exactResults: [mockTrustee1] });
    const completeSpy = vi.spyOn(context.observability, 'completeTrace');

    const useCase = new TrusteeSearchUseCase();
    await useCase.searchTrustees(context, 'smith');

    expect(completeSpy).toHaveBeenCalledWith(
      expect.any(Object),
      'TrusteeManualSearchPerformed',
      expect.objectContaining({
        properties: expect.objectContaining({
          courtIdFilter: 'none',
        }),
      }),
    );
  });

  test('should log telemetry on failed search and propagate error', async () => {
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        searchTrusteesByName: vi.fn().mockRejectedValue(new Error('DB failure')),
        searchTrusteesByPhoneticTokens: vi.fn().mockResolvedValue([]),
      }),
    );
    const completeSpy = vi.spyOn(context.observability, 'completeTrace');

    const useCase = new TrusteeSearchUseCase();

    await expect(useCase.searchTrustees(context, 'smith')).rejects.toThrow();

    expect(completeSpy).toHaveBeenCalledWith(
      expect.any(Object),
      'TrusteeManualSearchPerformed',
      expect.objectContaining({ success: false }),
    );
  });
});
