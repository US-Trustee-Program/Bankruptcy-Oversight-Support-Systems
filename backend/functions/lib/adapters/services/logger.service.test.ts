const context = require('azure-function-context-mock');
import { Context } from '@azure/functions';
import log from './logger.service';
import { applicationContextCreator } from '../utils/application-context-creator';

describe('Basic logger service tests', () => {
  let applicationContext;
  let mockLog;

  beforeEach(async () => {
    applicationContext = await applicationContextCreator(context);
    mockLog = jest.spyOn(applicationContext, 'log');
  });

  test('logMessage() should throw an error if context doesnt contain a log method.', async () => {
    const mockContext = await applicationContextCreator({ foo: 'bar' } as unknown as Context);

    expect(() => {
      log.info(mockContext, 'FOO-MODULE_NAME', 'test message');
    }).toThrow(new Error('Context does not contain a log function'));
  });

  test('Info log should set context.log to the expected string', async () => {
    log.info(applicationContext, 'FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[INFO] [FOO-MODULE_NAME] test message');
  });

  test('Warning log should set context.log to the expected string', async () => {
    log.warn(applicationContext, 'FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[WARN] [FOO-MODULE_NAME] test message');
  });

  test('Error log should set context.log to the expected string', async () => {
    log.error(applicationContext, 'FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[ERROR] [FOO-MODULE_NAME] test message');
  });

  test('Debug log should set context.log to the expected string', async () => {
    log.debug(applicationContext, 'FOO-MODULE_NAME', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[DEBUG] [FOO-MODULE_NAME] test message');
  });

  test('Info log with an object passed to it, should set context.log to the expected string', async () => {
    const testObj = {
      property: 'value',
    };

    log.info(applicationContext, 'FOO-MODULE_NAME', 'test message', testObj);
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
