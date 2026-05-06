import { describe, test, expect, vi, beforeEach, Mocked } from 'vitest';
import { CaseAssociatedUseCase } from './case-associated';
import { ApplicationContext } from '../../adapters/types/basic';
import { CasesRepository } from '../gateways.types';
import factory from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';

vi.mock('../../factory');
const mockFactory = factory as Mocked<typeof factory>;

describe('CaseAssociatedUseCase', () => {
  let useCase: CaseAssociatedUseCase;
  let context: ApplicationContext;
  let mockCasesRepo: Mocked<CasesRepository>;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.request.params = { caseId: 'AAA-24-00001' };

    mockCasesRepo = {
      getConsolidation: vi.fn(),
    } as unknown as Mocked<CasesRepository>;

    mockFactory.getCasesRepository = vi.fn().mockReturnValue(mockCasesRepo);

    useCase = new CaseAssociatedUseCase();
  });

  test('returns empty array when consolidation is empty', async () => {
    mockCasesRepo.getConsolidation.mockResolvedValue([]);
    const result = await useCase.getAssociatedCases(context);
    expect(result).toEqual([]);
  });

  test('handles lead case path when consolidation.length > 1', async () => {
    const member1 = MockData.getConsolidation({
      override: {
        documentType: 'CONSOLIDATION_FROM',
        caseId: 'AAA-24-00001',
        orderDate: '2024-03-01',
      },
    });
    const member2 = MockData.getConsolidation({
      override: {
        documentType: 'CONSOLIDATION_FROM',
        caseId: 'AAA-24-00001',
        orderDate: '2024-01-15',
      },
    });
    const leadRef = MockData.getConsolidation({
      override: {
        documentType: 'CONSOLIDATION_TO',
        caseId: 'BBB-24-00002',
        orderDate: '2024-01-15',
      },
    });

    mockCasesRepo.getConsolidation
      .mockResolvedValueOnce([member1, member2])
      .mockResolvedValueOnce([leadRef]);

    const result = await useCase.getAssociatedCases(context);

    expect(mockCasesRepo.getConsolidation).toHaveBeenCalledTimes(2);
    expect(mockCasesRepo.getConsolidation).toHaveBeenNthCalledWith(2, member1.otherCase.caseId);
    expect(result[0]).toBe(leadRef);
    expect(result[0].orderDate).toBe('2024-01-15');
    expect(result).toContain(member1);
    expect(result).toContain(member2);
  });

  test('handles lead case path when single element has CONSOLIDATION_FROM documentType', async () => {
    const member = MockData.getConsolidation({
      override: {
        documentType: 'CONSOLIDATION_FROM',
        caseId: 'AAA-24-00001',
        orderDate: '2024-06-10',
      },
    });
    const leadRef = MockData.getConsolidation({
      override: {
        documentType: 'CONSOLIDATION_TO',
        caseId: 'BBB-24-00002',
        orderDate: '2024-06-10',
      },
    });

    mockCasesRepo.getConsolidation.mockResolvedValueOnce([member]).mockResolvedValueOnce([leadRef]);

    const result = await useCase.getAssociatedCases(context);

    expect(mockCasesRepo.getConsolidation).toHaveBeenCalledTimes(2);
    expect(result[0]).toBe(leadRef);
    expect(result[1]).toBe(member);
  });

  test('handles member case path (CONSOLIDATION_TO as single element)', async () => {
    const leadRef = MockData.getConsolidation({
      override: {
        documentType: 'CONSOLIDATION_TO',
        caseId: 'AAA-24-00001',
        orderDate: '2024-05-01',
      },
    });
    const m1 = MockData.getConsolidation({
      override: {
        documentType: 'CONSOLIDATION_FROM',
        caseId: 'LEAD-24-00001',
        orderDate: '2024-04-10',
      },
    });
    const m2 = MockData.getConsolidation({
      override: {
        documentType: 'CONSOLIDATION_FROM',
        caseId: 'LEAD-24-00001',
        orderDate: '2024-05-01',
      },
    });

    mockCasesRepo.getConsolidation.mockResolvedValueOnce([leadRef]).mockResolvedValueOnce([m1, m2]);

    const result = await useCase.getAssociatedCases(context);

    expect(mockCasesRepo.getConsolidation).toHaveBeenCalledTimes(2);
    expect(mockCasesRepo.getConsolidation).toHaveBeenNthCalledWith(2, leadRef.otherCase.caseId);
    expect(result[0]).toBe(leadRef);
    expect(result[0].orderDate).toBe('2024-04-10');
    expect(result).toContain(m1);
    expect(result).toContain(m2);
  });

  test('getEarliestDate picks the smallest orderDate from multiple members', async () => {
    const m1 = MockData.getConsolidation({
      override: { documentType: 'CONSOLIDATION_FROM', orderDate: '2024-07-01' },
    });
    const m2 = MockData.getConsolidation({
      override: { documentType: 'CONSOLIDATION_FROM', orderDate: '2024-02-15' },
    });
    const m3 = MockData.getConsolidation({
      override: { documentType: 'CONSOLIDATION_FROM', orderDate: '2024-11-30' },
    });
    const leadRef = MockData.getConsolidation({
      override: { documentType: 'CONSOLIDATION_TO', orderDate: '2024-02-15' },
    });

    mockCasesRepo.getConsolidation
      .mockResolvedValueOnce([m1, m2, m3])
      .mockResolvedValueOnce([leadRef]);

    const result = await useCase.getAssociatedCases(context);

    expect(result[0].orderDate).toBe('2024-02-15');
  });
});
