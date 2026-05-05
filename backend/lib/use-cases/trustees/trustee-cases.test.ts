import { vi } from 'vitest';
import { TrusteeCasesUseCase } from './trustee-cases';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeCaseListItem } from '@common/cams/trustee-cases';

const mockCaseListItem: TrusteeCaseListItem = {
  caseId: '111-24-00001',
  caseTitle: 'Smith, John',
  chapter: '7',
  dateFiled: '2024-01-15',
  appointedDate: '2024-01-20',
};

describe('TrusteeCasesUseCase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns cases when repo returns results', async () => {
    const mockResponse = { data: [mockCaseListItem], metadata: { total: 1 } };
    vi.spyOn(MockMongoRepository.prototype, 'getCasesForTrustee').mockResolvedValue(mockResponse);
    const context = await createMockApplicationContext();
    const useCase = new TrusteeCasesUseCase();

    const result = await useCase.getCasesForTrustee(context, 'trustee-1', {
      offset: 0,
      limit: 25,
    });

    expect(result).toEqual(mockResponse);
  });

  test('rethrows when repo throws', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'getCasesForTrustee').mockRejectedValue(
      new Error('DB error'),
    );
    const context = await createMockApplicationContext();
    const useCase = new TrusteeCasesUseCase();

    await expect(
      useCase.getCasesForTrustee(context, 'trustee-1', { offset: 0, limit: 25 }),
    ).rejects.toThrow();
  });
});
