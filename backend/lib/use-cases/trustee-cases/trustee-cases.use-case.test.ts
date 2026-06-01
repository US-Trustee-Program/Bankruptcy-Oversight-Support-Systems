import { vi } from 'vitest';
import { TrusteeCasesUseCase } from './trustee-cases.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { SyncedCase } from '@common/cams/cases';

describe('TrusteeCasesUseCase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns empty result without calling searchCases when trustee has no active appointments', async () => {
    const context = await createMockApplicationContext();
    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockResolvedValue([]);
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchCases');

    const useCase = new TrusteeCasesUseCase();
    const result = await useCase.getCasesForTrustee(context, 'trustee-abc', 25, 0);

    expect(result.data).toEqual([]);
    expect(result.metadata?.total).toBe(0);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  test('returns merged items sorted by dateFiled descending', async () => {
    const context = await createMockApplicationContext();

    // Use same caseId prefix so sort must be driven by dateFiled, not caseId
    const appointments = [
      { id: 'appt-1', caseId: '081-24-00001', trusteeId: 'trustee-abc', assignedOn: '2024-01-10' },
      { id: 'appt-2', caseId: '081-24-00002', trusteeId: 'trustee-abc', assignedOn: '2024-06-01' },
    ] as unknown as CaseAppointment[];

    const syncedCases = [
      { caseId: '081-24-00001', caseNumber: '24-00001', chapter: '7', dateFiled: '2021-03-01' },
      { caseId: '081-24-00002', caseNumber: '24-00002', chapter: '13', dateFiled: '2024-01-01' },
    ] as unknown as SyncedCase[];

    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockResolvedValue(appointments);
    vi.spyOn(MockMongoRepository.prototype, 'searchCases').mockResolvedValue({
      data: syncedCases,
      metadata: { total: syncedCases.length },
    });

    const useCase = new TrusteeCasesUseCase();
    const result = await useCase.getCasesForTrustee(context, 'trustee-abc', 25, 0);

    expect(result.data).toHaveLength(2);
    // Most recent dateFiled first
    expect(result.data[0].caseId).toBe('081-24-00002');
    expect(result.data[0].dateFiled).toBe('2024-01-01');
    expect(result.data[1].caseId).toBe('081-24-00001');
    expect(result.data[1].dateFiled).toBe('2021-03-01');
    expect(result.metadata?.total).toBe(2);
  });

  test('skips appointments whose caseId has no matching SyncedCase and calls searchCases', async () => {
    const context = await createMockApplicationContext();

    const appointments = [
      { id: 'appt-1', caseId: '081-24-00001', trusteeId: 'trustee-abc', assignedOn: '2024-01-01' },
    ] as unknown as CaseAppointment[];

    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockResolvedValue(appointments);
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchCases').mockResolvedValue({
      data: [],
      metadata: { total: 0 },
    });

    const useCase = new TrusteeCasesUseCase();
    const result = await useCase.getCasesForTrustee(context, 'trustee-abc', 25, 0);

    expect(result.data).toEqual([]);
    expect(result.metadata?.total).toBe(0);
    // searchCases WAS called (unlike the empty-appointments path)
    expect(searchSpy).toHaveBeenCalledOnce();
  });

  test('fetches all cases with limit 500 for the in-memory sort+slice approach', async () => {
    const context = await createMockApplicationContext();

    const appointments = [
      { id: 'appt-1', caseId: '081-24-00001', trusteeId: 'trustee-abc', assignedOn: '2024-01-01' },
    ] as unknown as CaseAppointment[];

    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockResolvedValue(appointments);
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchCases').mockResolvedValue({
      data: [
        { caseId: '081-24-00001', caseNumber: '24-00001', chapter: '7', dateFiled: '2024-01-01' },
      ] as unknown as SyncedCase[],
      metadata: { total: 1 },
    });

    const useCase = new TrusteeCasesUseCase();
    await useCase.getCasesForTrustee(context, 'trustee-abc', 25, 0);

    expect(searchSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 500, offset: 0 }));
  });

  test('applies offset and limit to paginate results, returning total before slice', async () => {
    const context = await createMockApplicationContext();

    const appointments = Array.from({ length: 30 }, (_, i) => ({
      id: `appt-${i}`,
      caseId: `081-24-${String(i).padStart(5, '0')}`,
      trusteeId: 'trustee-abc',
      assignedOn: `2024-01-${String(i + 1).padStart(2, '0')}`,
    })) as unknown as CaseAppointment[];

    const syncedCases = appointments.map((a, i) => ({
      caseId: a.caseId,
      caseNumber: `24-${String(i).padStart(5, '0')}`,
      chapter: '7',
      dateFiled: `2024-01-${String(i + 1).padStart(2, '0')}`,
    })) as unknown as SyncedCase[];

    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockResolvedValue(appointments);

    vi.spyOn(MockMongoRepository.prototype, 'searchCases').mockResolvedValue({
      data: syncedCases,
      metadata: { total: syncedCases.length },
    });

    const useCase = new TrusteeCasesUseCase();
    const page1 = await useCase.getCasesForTrustee(context, 'trustee-abc', 25, 0);
    const page2 = await useCase.getCasesForTrustee(context, 'trustee-abc', 25, 25);

    expect(page1.data).toHaveLength(25);
    expect(page2.data).toHaveLength(5);
    // total reflects pre-slice count on both pages
    expect(page1.metadata?.total).toBe(30);
    expect(page2.metadata?.total).toBe(30);
  });

  test('wraps errors with getCamsErrorWithStack', async () => {
    const context = await createMockApplicationContext();

    vi.spyOn(
      MockMongoRepository.prototype,
      'getActiveCaseAppointmentsByTrusteeId',
    ).mockRejectedValue(new Error('db connection lost'));

    const useCase = new TrusteeCasesUseCase();
    await expect(useCase.getCasesForTrustee(context, 'trustee-abc', 25, 0)).rejects.toMatchObject({
      isCamsError: true,
      message: expect.stringContaining('Failed to retrieve cases for trustee trustee-abc'),
    });
  });
});
