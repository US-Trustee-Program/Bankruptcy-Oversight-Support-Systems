import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import CaseReloadUseCase from './case-reload';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

describe('Case Reload Use Case', () => {
  const TEST_CASE_ID = '081-12-34567';

  let mockContext: ApplicationContext;
  let queueCaseReloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockContext = await createMockApplicationContext();

    queueCaseReloadSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
      queueCaseReload: queueCaseReloadSpy,
      queueCaseAssignmentEvent: vi.fn(),
    });
  });

  test('should successfully queue case reload via ApiToDataflowsGateway', async () => {
    await CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID);

    expect(factory.getApiToDataflowsGateway).toHaveBeenCalledWith(mockContext);
    expect(queueCaseReloadSpy).toHaveBeenCalledWith(TEST_CASE_ID);
  });

  test('should propagate errors from gateway', async () => {
    const errorMessage = 'Queue write failed';
    queueCaseReloadSpy.mockRejectedValueOnce(new Error(errorMessage));

    await expect(CaseReloadUseCase.queueCaseReload(mockContext, TEST_CASE_ID)).rejects.toThrow(
      errorMessage,
    );
  });
});
