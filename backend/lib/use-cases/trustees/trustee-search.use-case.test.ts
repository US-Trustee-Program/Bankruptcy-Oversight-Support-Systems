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

  function setupRepositories(
    trustees: Partial<Trustee>[],
    appointmentsByTrustee?: Partial<TrusteeAppointment>[][],
  ) {
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        searchTrusteesByName: vi.fn().mockResolvedValue(trustees),
      }),
    );
    const appointmentsMock = vi.fn();
    if (appointmentsByTrustee) {
      for (const appts of appointmentsByTrustee) {
        appointmentsMock.mockResolvedValueOnce(appts);
      }
    } else {
      appointmentsMock.mockResolvedValue([]);
    }
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getTrusteeAppointments: appointmentsMock,
      }),
    );
  }

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return trustees with their appointments for a name search', async () => {
    setupRepositories([mockTrustee1, mockTrustee2], [mockAppointments1, mockAppointments2]);

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'smith');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      trusteeId: 'trustee-001',
      name: 'John Smith',
      address: mockTrustee1.public.address,
      phone: mockTrustee1.public.phone,
      email: 'john.smith@example.com',
      appointments: mockAppointments1,
    });
    expect(results[1]).toEqual({
      trusteeId: 'trustee-002',
      name: 'Jane Smithson',
      address: mockTrustee2.public.address,
      phone: mockTrustee2.public.phone,
      email: 'jane.smithson@example.com',
      appointments: mockAppointments2,
    });
  });

  test('should return empty array when no trustees match', async () => {
    setupRepositories([]);

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'zzzzz');

    expect(results).toEqual([]);
  });

  test('should cap results at 25 trustees', async () => {
    const manyTrustees = Array.from({ length: 30 }, (_, i) => ({
      ...mockTrustee1,
      id: `doc-${i}`,
      trusteeId: `trustee-${i}`,
      name: `Smith Trustee ${i}`,
    }));

    setupRepositories(manyTrustees);

    const useCase = new TrusteeSearchUseCase();
    const results = await useCase.searchTrustees(context, 'smith');

    expect(results).toHaveLength(25);
  });

  test('should log telemetry on successful search', async () => {
    setupRepositories([mockTrustee1], [mockAppointments1]);
    const completeSpy = vi.spyOn(context.observability, 'completeTrace');

    const useCase = new TrusteeSearchUseCase();
    await useCase.searchTrustees(context, 'smith');

    expect(completeSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ success: true }),
    );
  });

  test('should log telemetry on failed search and propagate error', async () => {
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        searchTrusteesByName: vi.fn().mockRejectedValue(new Error('DB failure')),
      }),
    );
    const completeSpy = vi.spyOn(context.observability, 'completeTrace');

    const useCase = new TrusteeSearchUseCase();

    await expect(useCase.searchTrustees(context, 'smith')).rejects.toThrow();

    expect(completeSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ success: false }),
    );
  });
});
