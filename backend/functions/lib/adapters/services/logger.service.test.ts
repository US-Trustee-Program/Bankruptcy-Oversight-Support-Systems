const context = require('azure-function-context-mock');
import { Context } from '@azure/functions';
import log from './logger.service';
import { applicationContextCreator } from '../utils/application-context-creator';

describe('Basic logger service tests', () => {
  let appContext;
  let mockLog;

  beforeEach(async () => {
    appContext = await applicationContextCreator(context);
    mockLog = jest.spyOn(appContext, 'log');
  });

  test('logMessage() should throw an error if context doesnt contain a log method.', async () => {
    const mockContext = await applicationContextCreator({ foo: 'bar' } as unknown as Context);
    try {
      log.info(mockContext, 'FOO-MODULE_NAME', 'test message');
    } catch (e) {
      expect(e).toEqual(Error('Context does not contain a log function'));
    }
  });

  test('Info log should set context.log to the expected string', async () => {
    log.info(appContext, 'FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[INFO] [FOO-MODULE_NAME] test message');
  });

  test('Warning log should set context.log to the expected string', async () => {
    log.warn(appContext, 'FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[WARN] [FOO-MODULE_NAME] test message');
  });

  test('Error log should set context.log to the expected string', async () => {
    log.error(appContext, 'FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[ERROR] [FOO-MODULE_NAME] test message');
  });

  test('Debug log should set context.log to the expected string', async () => {
    log.debug(appContext, 'FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[DEBUG] [FOO-MODULE_NAME] test message');
  });

  test('Info log with an object passed to it, should set context.log to the expected string', async () => {
    const testObj = {
      property: 'value',
    };

    log.info(appContext, 'FOO-MODULE_NAME', 'test message', testObj);
    expect(mockLog).toHaveBeenCalledWith(
      `[INFO] [FOO-MODULE_NAME] test message ${JSON.stringify(testObj)}`,
    );
  });

  test('Test sanitize function to Fix CWE 117 Improper Output Neutralization for Logs', async () => {
    const input = '\r\nNo\r\nCRLF\r\n';
    const output = log.sanitize(input);
    expect(output).not.toContain('\n');
    expect(output).not.toContain('\r');
  });
});
