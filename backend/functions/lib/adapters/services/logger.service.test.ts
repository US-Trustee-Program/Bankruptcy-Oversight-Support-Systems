const context = require('azure-function-context-mock');
import log from './logger.service';

const mockLog = jest.spyOn(context, 'log');

describe('Basic logger service tests', () => {
  test('Info log should set context.log to the expected string', async () => {
    log.info(context, 'FOO-NAMESPACE', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[INFO] [FOO-NAMESPACE] test message');
  });
  test('Warning log should set context.log to the expected string', async () => {
    log.warn(context, 'FOO-NAMESPACE', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[WARN] [FOO-NAMESPACE] test message');
  });
  test('Error log should set context.log to the expected string', async () => {
    log.error(context, 'FOO-NAMESPACE', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[ERROR] [FOO-NAMESPACE] test message');
  });
  test('Debug log should set context.log to the expected string', async () => {
    log.debug(context, 'FOO-NAMESPACE', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[DEBUG] [FOO-NAMESPACE] test message');
  });
  test('Info log with an object passed to it, should set context.log to the expected string', async () => {
    const testObj = {
      property: 'value'
    }

    log.info(context, 'FOO-NAMESPACE', 'test message', testObj);
    expect(mockLog).toHaveBeenCalledWith(`[INFO] [FOO-NAMESPACE] test message ${JSON.stringify(testObj)}`);
  });

  test('Test sanitize function to Fix CWE 117 Improper Output Neutralization for Logs', async () => {
    const input = '\r\nNo\r\nCRLF\r\n';
    let output = log.sanitize(input)
    expect(output).not.toContain('\n')
    expect(output).not.toContain('\r')
  });
});
