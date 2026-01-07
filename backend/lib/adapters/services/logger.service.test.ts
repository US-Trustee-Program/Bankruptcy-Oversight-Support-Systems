import { vi } from 'vitest';
// eslint-disable testing-library/no-debugging-utils

import { LoggerImpl } from './logger.service';
import { randomUUID } from 'crypto';
import MockData from '@common/cams/test-utilities/mock-data';

describe('Basic logger service tests', () => {
  let mockLog;
  let logger;
  const invocationId = randomUUID();

  beforeEach(async () => {
    mockLog = vi.fn();
    logger = new LoggerImpl(invocationId, mockLog);
  });

  test('should default to using console.log if a logger provider is not provided.', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    logger = new LoggerImpl(invocationId);

    logger.info('FOO-MODULE_NAME', 'test message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('Info log should set context.log to the expected string', async () => {
    logger.info('FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith(
      `[INFO] [FOO-MODULE_NAME] [INVOCATION ${invocationId}] test message`,
    );
  });

  test('Warning log should set context.log to the expected string', async () => {
    logger.warn('FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith(
      `[WARN] [FOO-MODULE_NAME] [INVOCATION ${invocationId}] test message`,
    );
  });

  test('Error log should set context.log to the expected string', async () => {
    logger.error('FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith(
      `[ERROR] [FOO-MODULE_NAME] [INVOCATION ${invocationId}] test message`,
    );
  });

  test('Debug log should set context.log to the expected string', async () => {
    logger.debug('FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith(
      `[DEBUG] [FOO-MODULE_NAME] [INVOCATION ${invocationId}] test message`,
    );
  });

  test('Info log with an object passed to it, should set context.log to the expected string', async () => {
    const testObj = {
      property: 'value',
    };

    logger.info('FOO-MODULE_NAME', 'test message', testObj);
    expect(mockLog).toHaveBeenCalledWith(
      `[INFO] [FOO-MODULE_NAME] [INVOCATION ${invocationId}] test message ${JSON.stringify(testObj)}`,
    );
  });

  test('should remove newlines from logged strings', async () => {
    logger.info('FOO-MODULE_NAME', '\r\ntest\r\nmessage\r\n');
    expect(mockLog).toHaveBeenCalledWith(
      `[INFO] [FOO-MODULE_NAME] [INVOCATION ${invocationId}]  test message`,
    );
  });

  test('should not log properties similar to disallowed properties', async () => {
    logger.info(
      'FOO-MODULE_NAME',
      `test message 123456789 ${MockData.randomEin()} ${MockData.randomSsn()}`,
      {
        sSN: MockData.randomSsn(),
        tAxid: MockData.randomEin(),
        prop1: 'foo',
        prop2: 'bar',
        prop3: {
          ssn: MockData.randomSsn(),
          prop3a: 'foo-a',
          prop3b: {
            taxID: MockData.randomEin(),
            prop3aa: 'test',
          },
          itin: MockData.randomSsn(),
          ein: MockData.randomEin(),
        },
      },
    );
    expect(mockLog).toHaveBeenCalledWith(
      `[INFO] [FOO-MODULE_NAME] [INVOCATION ${invocationId}] test message [REDACTED] [REDACTED] [REDACTED] {"prop1":"foo","prop2":"bar","prop3":{"prop3a":"foo-a","prop3b":{"prop3aa":"test"}}}`,
    );
  });
});
