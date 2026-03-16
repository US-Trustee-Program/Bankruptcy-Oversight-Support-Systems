import { describe, test, beforeEach, vi, expect } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as handler from './case-deleted-event';
import * as archiveModule from '../../../lib/use-cases/dataflows/archive-case-documents';
import ContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CASE_DELETED_EVENT_DLQ } from '../../../lib/storage-queues';
import { CaseDeletedEvent } from '../../../lib/use-cases/dataflows/detect-deleted-cases';

describe('case-deleted-event queue trigger', () => {
  let invocationContext: Partial<InvocationContext>;

  beforeEach(() => {
    vi.restoreAllMocks();
    invocationContext = {
      invocationId: 'test-invocation-id',
      extraOutputs: new Map(),
    };
  });

  test('should call archiveCaseAndRelatedDocuments with caseId from event', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const archiveSpy = vi.spyOn(archiveModule, 'archiveCaseAndRelatedDocuments').mockResolvedValue({
      caseId: '001-25-00001',
      archivedCount: 5,
      errors: [],
    });

    const event: CaseDeletedEvent = {
      type: 'CASE_DELETED',
      caseId: '001-25-00001',
      deletedDate: '2025-02-11',
    };

    await handler.archiveDeletedCaseHandler(event, invocationContext);

    expect(archiveSpy).toHaveBeenCalledWith(mockContext, '001-25-00001');
  });

  test('should not route to DLQ on successful archival', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    vi.spyOn(archiveModule, 'archiveCaseAndRelatedDocuments').mockResolvedValue({
      caseId: '001-25-00001',
      archivedCount: 5,
      errors: [],
    });

    const event: CaseDeletedEvent = {
      type: 'CASE_DELETED',
      caseId: '001-25-00001',
      deletedDate: '2025-02-11',
    };

    await handler.archiveDeletedCaseHandler(event, invocationContext);

    expect(invocationContext.extraOutputs.get(CASE_DELETED_EVENT_DLQ)).toBeUndefined();
  });

  test('should route errors to DLQ', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const testError = new Error('Archive failed');
    vi.spyOn(archiveModule, 'archiveCaseAndRelatedDocuments').mockRejectedValue(testError);

    const event: CaseDeletedEvent = {
      type: 'CASE_DELETED',
      caseId: '001-25-00001',
      deletedDate: '2025-02-11',
    };

    await handler.archiveDeletedCaseHandler(event, invocationContext);

    const dlqMessage = invocationContext.extraOutputs.get(CASE_DELETED_EVENT_DLQ);
    expect(dlqMessage).toBeDefined();
    expect(dlqMessage.event).toEqual(event);
    expect(dlqMessage.error).toEqual(testError);
  });

  test('should log archival summary', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    vi.spyOn(archiveModule, 'archiveCaseAndRelatedDocuments').mockResolvedValue({
      caseId: '001-25-00001',
      archivedCount: 5,
      errors: [],
    });

    const loggerSpy = vi.spyOn(mockContext.logger, 'info');

    const event: CaseDeletedEvent = {
      type: 'CASE_DELETED',
      caseId: '001-25-00001',
      deletedDate: '2025-02-11',
    };

    await handler.archiveDeletedCaseHandler(event, invocationContext);

    expect(loggerSpy).toHaveBeenCalledWith(
      'CASE-DELETED-EVENT',
      expect.stringContaining('001-25-00001'),
    );
  });

  test('should handle event with missing caseId', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const testError = new Error('caseId is required');
    vi.spyOn(archiveModule, 'archiveCaseAndRelatedDocuments').mockRejectedValue(testError);

    const event = {
      type: 'CASE_DELETED',
      caseId: '',
      deletedDate: '2025-02-11',
    } as CaseDeletedEvent;

    await handler.archiveDeletedCaseHandler(event, invocationContext);

    const dlqMessage = invocationContext.extraOutputs.get(CASE_DELETED_EVENT_DLQ);
    expect(dlqMessage).toBeDefined();
    expect(dlqMessage.event).toEqual(event);
    expect(dlqMessage.error).toEqual(testError);
  });
});
