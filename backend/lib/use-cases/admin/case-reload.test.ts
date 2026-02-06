import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import CaseReloadUseCase from './case-reload';

describe('Case Reload Use Case', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CAMS_DATAFLOWS_BASE_URL;
    delete process.env.ADMIN_KEY;
  });

  test('should successfully queue case reload via HTTP POST', async () => {
    process.env.CAMS_DATAFLOWS_BASE_URL = 'http://localhost:7072';
    process.env.ADMIN_KEY = 'test-key-123';

    const mockContext = await createMockApplicationContext();
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
    } as Response);

    const caseId = '081-12-34567';
    await CaseReloadUseCase.queueCaseReload(mockContext, caseId);

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:7072/sync-cases-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey test-key-123',
      },
      body: JSON.stringify({ caseIds: [caseId] }),
    });
  });

  test('should log success when case reload is queued', async () => {
    process.env.CAMS_DATAFLOWS_BASE_URL = 'http://localhost:7072';
    process.env.ADMIN_KEY = 'test-key-123';

    const mockContext = await createMockApplicationContext();
    const mockLoggerInfo = vi.spyOn(mockContext.logger, 'info');

    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
    } as Response);

    const caseId = '081-12-34567';
    await CaseReloadUseCase.queueCaseReload(mockContext, caseId);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'CASE-RELOAD-USE-CASE',
      'Successfully queued case reload for: 081-12-34567',
    );
  });

  test('should throw error when CAMS_DATAFLOWS_BASE_URL is not configured', async () => {
    process.env.ADMIN_KEY = 'test-key-123';

    const mockContext = await createMockApplicationContext();

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, '081-12-34567')).rejects.toThrow(
      'CAMS_DATAFLOWS_BASE_URL not configured',
    );
  });

  test('should throw error when ADMIN_KEY is not configured', async () => {
    process.env.CAMS_DATAFLOWS_BASE_URL = 'http://localhost:7072';

    const mockContext = await createMockApplicationContext();

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, '081-12-34567')).rejects.toThrow(
      'ADMIN_KEY not configured',
    );
  });

  test('should throw error when HTTP request fails', async () => {
    process.env.CAMS_DATAFLOWS_BASE_URL = 'http://localhost:7072';
    process.env.ADMIN_KEY = 'test-key-123';

    const mockContext = await createMockApplicationContext();
    const mockLoggerError = vi.spyOn(mockContext.logger, 'error');

    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Queue write failed',
    } as Response);

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, '081-12-34567')).rejects.toThrow(
      'Failed to queue case reload: 500 Internal Server Error - Queue write failed',
    );

    expect(mockLoggerError).toHaveBeenCalled();
  });

  test('should throw error when network request fails', async () => {
    process.env.CAMS_DATAFLOWS_BASE_URL = 'http://localhost:7072';
    process.env.ADMIN_KEY = 'test-key-123';

    const mockContext = await createMockApplicationContext();
    const mockLoggerError = vi.spyOn(mockContext.logger, 'error');

    fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, '081-12-34567')).rejects.toThrow(
      'Network error',
    );

    expect(mockLoggerError).toHaveBeenCalled();
  });
});
