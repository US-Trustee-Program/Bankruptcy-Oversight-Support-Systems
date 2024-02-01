import { LoggerImpl } from './logger.service';

describe('Basic logger service tests', () => {
  let mockLog;
  let logger;

  beforeEach(async () => {
    mockLog = jest.fn();
    logger = new LoggerImpl(mockLog);
  });

  test('should default to using console.log if a logger provider is not provided.', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    logger = new LoggerImpl();

    logger.info('FOO-MODULE_NAME', 'test message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('Info log should set context.log to the expected string', async () => {
    logger.info('FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[INFO] [FOO-MODULE_NAME] test message');
  });

  test('Warning log should set context.log to the expected string', async () => {
    logger.warn('FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[WARN] [FOO-MODULE_NAME] test message');
  });

  test('Error log should set context.log to the expected string', async () => {
    logger.error('FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[ERROR] [FOO-MODULE_NAME] test message');
  });

  test('Debug log should set context.log to the expected string', async () => {
    logger.debug('FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[DEBUG] [FOO-MODULE_NAME] test message');
  });

  test('Info log with an object passed to it, should set context.log to the expected string', async () => {
    const testObj = {
      property: 'value',
    };

    logger.info('FOO-MODULE_NAME', 'test message', testObj);
    expect(mockLog).toHaveBeenCalledWith(
      `[INFO] [FOO-MODULE_NAME] test message ${JSON.stringify(testObj)}`,
    );
  });

  test('Test sanitize function to Fix CWE 117 Improper Output Neutralization for Logs', async () => {
    logger.info('FOO-MODULE_NAME', '\r\ntest\r\nmessage\r\n');
    expect(mockLog).toHaveBeenCalledWith('[INFO] [FOO-MODULE_NAME]  test message');
  });
});
