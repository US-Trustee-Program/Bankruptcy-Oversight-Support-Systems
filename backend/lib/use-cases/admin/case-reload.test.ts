import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import CaseReloadUseCase from './case-reload';
import { ApplicationContext } from '../../adapters/types/basic';

describe('Case Reload Use Case', () => {
  const TEST_BASE_URL = 'http://localhost:7072';
  const TEST_ADMIN_KEY = 'test-key-123';
  const TEST_CASE_ID = '081-12-34567';

  let mockContext: ApplicationContext;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  async function setupValidEnv() {
    process.env.CAMS_DATAFLOWS_BASE_URL = TEST_BASE_URL;
    process.env.ADMIN_KEY = TEST_ADMIN_KEY;
    mockContext = await createMockApplicationContext();
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.CAMS_DATAFLOWS_BASE_URL;
    delete process.env.ADMIN_KEY;
  });

  test('should successfully queue case reload via HTTP POST with timeout signal', async () => {
    await setupValidEnv();
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
    } as Response);

    await CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID);

    expect(fetchSpy).toHaveBeenCalledWith(`${TEST_BASE_URL}/sync-cases-page`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${TEST_ADMIN_KEY}`,
      },
      body: JSON.stringify({ caseIds: [TEST_CASE_ID] }),
      signal: expect.any(AbortSignal),
    });
  });

  test('should log success when case reload is queued', async () => {
    await setupValidEnv();
    const mockLoggerInfo = vi.spyOn(mockContext.logger, 'info');
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
    } as Response);

    await CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'DATAFLOWS-HTTP-GATEWAY',
      `Successfully queued case reload for: ${TEST_CASE_ID}`,
    );
  });

  test('should throw error when CAMS_DATAFLOWS_BASE_URL is not configured', async () => {
    process.env.ADMIN_KEY = TEST_ADMIN_KEY;
    mockContext = await createMockApplicationContext();

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID)).rejects.toThrow(
      'CAMS_DATAFLOWS_BASE_URL not configured',
    );
  });

  test('should throw error when ADMIN_KEY is not configured', async () => {
    process.env.CAMS_DATAFLOWS_BASE_URL = TEST_BASE_URL;
    mockContext = await createMockApplicationContext();

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID)).rejects.toThrow(
      'ADMIN_KEY not configured',
    );
  });

  test('should throw error when HTTP request fails', async () => {
    await setupValidEnv();
    const mockLoggerError = vi.spyOn(mockContext.logger, 'error');
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Queue write failed',
    } as Response);

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID)).rejects.toThrow(
      'Failed to queue case reload: 500 Internal Server Error - Queue write failed',
    );
    expect(mockLoggerError).toHaveBeenCalled();
  });

  test('should throw timeout error when request times out', async () => {
    await setupValidEnv();
    const mockLoggerError = vi.spyOn(mockContext.logger, 'error');
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(abortError);

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID)).rejects.toThrow(
      `Request timeout while queueing case reload for ${TEST_CASE_ID}`,
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.any(String),
      `Timeout queueing case reload for ${TEST_CASE_ID}`,
    );
  });

  test('should throw error when network request fails', async () => {
    await setupValidEnv();
    const mockLoggerError = vi.spyOn(mockContext.logger, 'error');
    fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID)).rejects.toThrow(
      'Network error',
    );
    expect(mockLoggerError).toHaveBeenCalled();
  });
});
