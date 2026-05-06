import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { CaseAssociatedUseCase } from './case-associated';
import { ApplicationContext } from '../../adapters/types/basic';
import { ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { CasesRepository } from '../gateways.types';
import factory from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';

vi.mock('../../factory');
const mockFactory = factory as Mocked<typeof factory>;

function makeCaseBasics(caseId: string) {
  return {
    caseId,
    dxtrId: '0',
    chapter: '11',
    caseTitle: `Case ${caseId}`,
    dateFiled: '2024-01-01',
    officeName: 'Office',
    officeCode: '001',
    courtId: 'court-1',
    courtName: 'Court One',
    courtDivisionCode: '001',
    courtDivisionName: 'Division One',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'Region Two',
  };
}

function makeConsolidationFrom(
  caseId: string,
  otherCaseId: string,
  orderDate: string,
): ConsolidationFrom {
  return {
    documentType: 'CONSOLIDATION_FROM',
    caseId,
    orderDate,
    otherCase: makeCaseBasics(otherCaseId),
    consolidationType: 'substantive',
    createdBy: { id: 'u1', name: 'User One' },
    updatedBy: { id: 'u1', name: 'User One' },
    updatedOn: '2024-01-01',
  };
}

function makeConsolidationTo(
  caseId: string,
  otherCaseId: string,
  orderDate: string,
): ConsolidationTo {
  return {
    documentType: 'CONSOLIDATION_TO',
    caseId,
    orderDate,
    otherCase: makeCaseBasics(otherCaseId),
    consolidationType: 'substantive',
    createdBy: { id: 'u1', name: 'User One' },
    updatedBy: { id: 'u1', name: 'User One' },
    updatedOn: '2024-01-01',
  };
}

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

  it('returns empty array when consolidation is empty', async () => {
    mockCasesRepo.getConsolidation.mockResolvedValue([]);
    const result = await useCase.getAssociatedCases(context);
    expect(result).toEqual([]);
  });

  it('handles lead case path when consolidation.length > 1', async () => {
    const member1 = makeConsolidationFrom('AAA-24-00001', 'BBB-24-00002', '2024-03-01');
    const member2 = makeConsolidationFrom('AAA-24-00001', 'CCC-24-00003', '2024-01-15');
    const leadRef = makeConsolidationTo('BBB-24-00002', 'AAA-24-00001', '2024-01-15');

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

  it('handles lead case path when single element has CONSOLIDATION_FROM documentType', async () => {
    const member = makeConsolidationFrom('AAA-24-00001', 'BBB-24-00002', '2024-06-10');
    const leadRef = makeConsolidationTo('BBB-24-00002', 'AAA-24-00001', '2024-06-10');

    mockCasesRepo.getConsolidation.mockResolvedValueOnce([member]).mockResolvedValueOnce([leadRef]);

    const result = await useCase.getAssociatedCases(context);

    expect(mockCasesRepo.getConsolidation).toHaveBeenCalledTimes(2);
    expect(result[0]).toBe(leadRef);
    expect(result[1]).toBe(member);
  });

  it('handles member case path (CONSOLIDATION_TO as single element)', async () => {
    const leadRef = makeConsolidationTo('AAA-24-00001', 'LEAD-24-00001', '2024-05-01');
    const m1 = makeConsolidationFrom('LEAD-24-00001', 'AAA-24-00001', '2024-04-10');
    const m2 = makeConsolidationFrom('LEAD-24-00001', 'BBB-24-00002', '2024-05-01');

    mockCasesRepo.getConsolidation.mockResolvedValueOnce([leadRef]).mockResolvedValueOnce([m1, m2]);

    const result = await useCase.getAssociatedCases(context);

    expect(mockCasesRepo.getConsolidation).toHaveBeenCalledTimes(2);
    expect(mockCasesRepo.getConsolidation).toHaveBeenNthCalledWith(2, leadRef.otherCase.caseId);
    expect(result[0]).toBe(leadRef);
    expect(result[0].orderDate).toBe('2024-04-10');
    expect(result).toContain(m1);
    expect(result).toContain(m2);
  });

  it('getEarliestDate picks the smallest orderDate from multiple members', async () => {
    const m1 = makeConsolidationFrom('AAA-24-00001', 'LEAD-24-99999', '2024-07-01');
    const m2 = makeConsolidationFrom('AAA-24-00001', 'LEAD-24-99999', '2024-02-15');
    const m3 = makeConsolidationFrom('AAA-24-00001', 'LEAD-24-99999', '2024-11-30');
    const leadRef = makeConsolidationTo('LEAD-24-99999', 'AAA-24-00001', '2024-02-15');

    mockCasesRepo.getConsolidation
      .mockResolvedValueOnce([m1, m2, m3])
      .mockResolvedValueOnce([leadRef]);

    const result = await useCase.getAssociatedCases(context);

    expect(result[0].orderDate).toBe('2024-02-15');
  });
});
