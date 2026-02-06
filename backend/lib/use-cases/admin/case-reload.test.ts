import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import CaseReloadUseCase from './case-reload';
import StorageQueueGateway from '../../adapters/gateways/storage-queue/storage-queue-gateway';
import { CaseSyncEvent } from '@common/queue/dataflow-types';

describe('Case Reload Use Case', () => {
  test('should queue case reload with correct event structure', async () => {
    const mockContext = await createMockApplicationContext();
    const mockEnqueue = vi.fn();

    vi.spyOn(StorageQueueGateway, 'using').mockReturnValue({
      enqueue: mockEnqueue,
    });

    const caseId = '081-12-34567';
    await CaseReloadUseCase.queueCaseReload(mockContext, caseId);

    expect(StorageQueueGateway.using).toHaveBeenCalledWith(mockContext, 'SYNC_CASES_PAGE');

    const expectedEvent: CaseSyncEvent = {
      type: 'CASE_CHANGED',
      caseId,
    };
    expect(mockEnqueue).toHaveBeenCalledWith(expectedEvent);
  });

  test('should log case reload queued event', async () => {
    const mockContext = await createMockApplicationContext();
    const mockEnqueue = vi.fn();
    const mockLoggerInfo = vi.spyOn(mockContext.logger, 'info');

    vi.spyOn(StorageQueueGateway, 'using').mockReturnValue({
      enqueue: mockEnqueue,
    });

    const caseId = '081-12-34567';
    await CaseReloadUseCase.queueCaseReload(mockContext, caseId);

    expect(mockLoggerInfo).toHaveBeenCalledWith('CASE-RELOAD-USE-CASE', 'Case reload queued', {
      caseId,
    });
  });
});
