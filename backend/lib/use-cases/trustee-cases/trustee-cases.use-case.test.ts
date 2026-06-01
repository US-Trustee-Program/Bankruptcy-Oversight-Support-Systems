import { vi } from 'vitest';
import { TrusteeCasesUseCase } from './trustee-cases.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { SyncedCase } from '@common/cams/cases';

describe('TrusteeCasesUseCase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns empty array when trustee has no active appointments', async () => {
    const context = await createMockApplicationContext();
    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockResolvedValue([]);

    const useCase = new TrusteeCasesUseCase();
    const result = await useCase.getCasesForTrustee(context, 'trustee-abc');

    expect(result).toEqual([]);
  });

  test('returns merged TrusteeCaseListItem array sorted by dateFiled descending', async () => {
    const context = await createMockApplicationContext();

    const appointments: CaseAppointment[] = [
      {
        ...MockData.getCamsUserReference(),
        id: 'appt-1',
        caseId: '081-23-00001',
        trusteeId: 'trustee-abc',
        assignedOn: '2023-01-10',
      },
      {
        ...MockData.getCamsUserReference(),
        id: 'appt-2',
        caseId: '081-24-00002',
        trusteeId: 'trustee-abc',
        assignedOn: '2024-06-01',
      },
    ];

    const syncedCases: SyncedCase[] = [
      {
        ...MockData.getCaseSummary(),
        caseId: '081-23-00001',
        caseNumber: '23-00001',
        chapter: '7',
        dateFiled: '2023-01-01',
      },
      {
        ...MockData.getCaseSummary(),
        caseId: '081-24-00002',
        caseNumber: '24-00002',
        chapter: '13',
        dateFiled: '2024-01-01',
      },
    ];

    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockResolvedValue(appointments);

    vi.spyOn(MockMongoRepository.prototype, 'searchCases').mockResolvedValue({
      data: syncedCases,
      meta: { self: '' },
    });

    const useCase = new TrusteeCasesUseCase();
    const result = await useCase.getCasesForTrustee(context, 'trustee-abc');

    expect(result).toHaveLength(2);
    expect(result[0].caseId).toBe('081-24-00002');
    expect(result[1].caseId).toBe('081-23-00001');
    expect(result[0].appointedDate).toBe('2024-06-01');
    expect(result[0].chapter).toBe('13');
  });

  test('skips appointments whose caseId has no matching SyncedCase', async () => {
    const context = await createMockApplicationContext();

    const appointments: CaseAppointment[] = [
      {
        ...MockData.getCamsUserReference(),
        id: 'appt-1',
        caseId: '081-24-00001',
        trusteeId: 'trustee-abc',
        assignedOn: '2024-01-01',
      },
    ];

    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockResolvedValue(appointments);

    vi.spyOn(MockMongoRepository.prototype, 'searchCases').mockResolvedValue({
      data: [],
      meta: { self: '' },
    });

    const useCase = new TrusteeCasesUseCase();
    const result = await useCase.getCasesForTrustee(context, 'trustee-abc');

    expect(result).toEqual([]);
  });
});
