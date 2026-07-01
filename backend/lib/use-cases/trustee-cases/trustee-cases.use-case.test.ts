import { vi } from 'vitest';
import { TrusteeCasesUseCase } from './trustee-cases.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';

describe('TrusteeCasesUseCase', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseItem: TrusteeCaseListItem = {
    caseId: '081-24-12345',
    caseNumber: '24-12345',
    courtDivisionName: 'Memphis',
    caseTitle: 'Debtor, Test',
    chapter: '7',
    dateFiled: '2024-01-15',
    appointedDate: '2024-01-15',
  };

  test('delegates to getCasesForTrustee on the repository with the correct arguments', async () => {
    const context = await createMockApplicationContext();
    const spy = vi
      .spyOn(MockMongoRepository.prototype, 'getCasesForTrustee')
      .mockResolvedValue({ data: [baseItem], metadata: { total: 1 } });

    const useCase = new TrusteeCasesUseCase();
    await useCase.getCasesForTrustee(context, 'trustee-abc', { limit: 25, offset: 0 });

    expect(spy).toHaveBeenCalledWith('trustee-abc', { limit: 25, offset: 0 });
  });

  test('returns the result from getCasesForTrustee unchanged', async () => {
    const context = await createMockApplicationContext();
    const expected = { data: [baseItem], metadata: { total: 1 } };
    vi.spyOn(MockMongoRepository.prototype, 'getCasesForTrustee').mockResolvedValue(expected);

    const useCase = new TrusteeCasesUseCase();
    const result = await useCase.getCasesForTrustee(context, 'trustee-abc', {
      limit: 25,
      offset: 0,
    });

    expect(result).toBe(expected);
  });

  test('errors from getCasesForTrustee propagate without being swallowed', async () => {
    const context = await createMockApplicationContext();
    vi.spyOn(MockMongoRepository.prototype, 'getCasesForTrustee').mockRejectedValue(
      new Error('repository failed'),
    );

    const useCase = new TrusteeCasesUseCase();
    await expect(
      useCase.getCasesForTrustee(context, 'trustee-abc', { limit: 25, offset: 0 }),
    ).rejects.toThrow('repository failed');
  });
});
