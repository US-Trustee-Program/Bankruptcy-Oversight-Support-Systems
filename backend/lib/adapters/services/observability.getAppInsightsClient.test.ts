import { vi, describe, test, expect, afterEach } from 'vitest';
import { LoggerImpl } from './logger.service';

vi.mock('applicationinsights', () => null);

import { getAppInsightsClient } from './observability';

const mockLogger = {
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as LoggerImpl;

describe('getAppInsightsClient - require scenarios', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should return null when appInsights module is falsy', () => {
    const result = getAppInsightsClient(mockLogger);

    expect(result).toBeNull();
  });
});
