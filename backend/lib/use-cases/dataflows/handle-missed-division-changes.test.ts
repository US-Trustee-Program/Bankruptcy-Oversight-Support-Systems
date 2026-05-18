import { vi, describe, test, expect, beforeEach, afterEach, Mocked } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { checkCaseForDivisionChange } from './handle-missed-division-changes';
import factory from '../../factory';
import { CasesRepository } from '../gateways.types';
import { SyncedCase } from '@common/cams/cases';
import { NotFoundError } from '../../common-errors/not-found-error';
import { closeDeferred } from '../../deferrable/defer-close';

describe('checkCaseForDivisionChange', () => {
  let context: ApplicationContext;
  let mockCasesRepo: Mocked<CasesRepository>;

  const mockSyncedCase: SyncedCase = {
    caseId: 'current-case-id',
    dxtrId: '123456',
    courtId: '081',
    documentType: 'SYNCED_CASE',
    chapter: 7,
  } as unknown as SyncedCase;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockCasesRepo = {
      getSyncedCase: vi.fn(),
      findSyncedCaseByDxtrId: vi.fn(),
      release: vi.fn(),
    } as unknown as Mocked<CasesRepository>;

    vi.spyOn(factory, 'getCasesRepository').mockReturnValue(mockCasesRepo);
  });

  afterEach(async () => {
    await closeDeferred(context);
  });

  test('should return null when getSyncedCase throws a not-found error', async () => {
    const caseId = 'missing-case-id';
    const notFoundError = new NotFoundError('TEST-MODULE', { message: 'Case not found' });

    mockCasesRepo.getSyncedCase.mockRejectedValue(notFoundError);

    const result = await checkCaseForDivisionChange(context, caseId);

    expect(result).toBeNull();
    expect(mockCasesRepo.getSyncedCase).toHaveBeenCalledWith(caseId);
  });

  test('should return null when no other case exists with the same dxtrId/courtId', async () => {
    const caseId = 'current-case-id';

    mockCasesRepo.getSyncedCase.mockResolvedValue(mockSyncedCase);
    mockCasesRepo.findSyncedCaseByDxtrId.mockResolvedValue(undefined);

    const result = await checkCaseForDivisionChange(context, caseId);

    expect(result).toBeNull();
    expect(mockCasesRepo.getSyncedCase).toHaveBeenCalledWith(caseId);
    expect(mockCasesRepo.findSyncedCaseByDxtrId).toHaveBeenCalledWith(
      mockSyncedCase.dxtrId,
      mockSyncedCase.courtId,
    );
  });

  test('should return null when the only matching case is the same caseId', async () => {
    const caseId = 'current-case-id';

    mockCasesRepo.getSyncedCase.mockResolvedValue(mockSyncedCase);
    mockCasesRepo.findSyncedCaseByDxtrId.mockResolvedValue(mockSyncedCase);

    const result = await checkCaseForDivisionChange(context, caseId);

    expect(result).toBeNull();
  });

  test('should return OrphanedCaseMessage when a different case with the same dxtrId/courtId exists', async () => {
    const caseId = 'new-case-id';
    const existingCase: SyncedCase = {
      ...mockSyncedCase,
      caseId: 'old-case-id',
    };

    mockCasesRepo.getSyncedCase.mockResolvedValue({
      ...mockSyncedCase,
      caseId,
    });
    mockCasesRepo.findSyncedCaseByDxtrId.mockResolvedValue(existingCase);

    const result = await checkCaseForDivisionChange(context, caseId);

    expect(result).toEqual({
      orphanedCaseId: 'old-case-id',
      currentCaseId: caseId,
    });
  });

  test('should re-throw a wrapped CamsError when getSyncedCase throws a non-not-found error', async () => {
    const caseId = 'test-case-id';
    const originalError = new Error('Database connection failed');

    mockCasesRepo.getSyncedCase.mockRejectedValue(originalError);

    await expect(checkCaseForDivisionChange(context, caseId)).rejects.toThrow();
  });

  test('should re-throw a wrapped CamsError when findSyncedCaseByDxtrId throws', async () => {
    const caseId = 'test-case-id';
    const originalError = new Error('Query failed');

    mockCasesRepo.getSyncedCase.mockResolvedValue(mockSyncedCase);
    mockCasesRepo.findSyncedCaseByDxtrId.mockRejectedValue(originalError);

    await expect(checkCaseForDivisionChange(context, caseId)).rejects.toThrow();
  });
});
