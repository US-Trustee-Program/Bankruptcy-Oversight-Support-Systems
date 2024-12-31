import { LoggerImpl } from './logger.service';
import { randomUUID } from 'crypto';

describe('Basic logger service tests', () => {
  let mockLog;
  let logger;
  const invocationId = randomUUID();

  beforeEach(async () => {
    mockLog = jest.fn();
    logger = new LoggerImpl(invocationId, mockLog);
  });

  test('should default to using console.log if a logger provider is not provided.', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
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
    logger.info('FOO-MODULE_NAME', 'test message', {
      sSN: '111-11-1111',
      tAxid: '11-1111111',
      prop1: 'foo',
      prop2: 'bar',
      prop3: {
        ssn: '123-45-6789',
        prop3a: 'foo-a',
        prop3b: {
          taxID: '33-3333333',
          prop3aa: 'test',
        },
      },
    });
    expect(mockLog).toHaveBeenCalledWith(
      `[INFO] [FOO-MODULE_NAME] [INVOCATION ${invocationId}] test message {"prop1":"foo","prop2":"bar","prop3":{"prop3a":"foo-a","prop3b":{"prop3aa":"test"}}}`,
    );
  });
});
