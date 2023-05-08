const context = require('azure-function-context-mock');
import log from '../services/logger.service';

const mockLog = jest.spyOn(context, 'log');

describe('Basic logger service tests', () => {
  test('Info log sets context.log to the expected string', async () => {
    log.info(context, 'FOO-NAMESPACE', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[INFO] [FOO-NAMESPACE] test message');
  });
  test('Warning log sets context.log to the expected string', async () => {
    log.warn(context, 'FOO-NAMESPACE', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[WARN] [FOO-NAMESPACE] test message');
  });
  test('Error log sets context.log to the expected string', async () => {
    log.error(context, 'FOO-NAMESPACE', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[ERROR] [FOO-NAMESPACE] test message');
  });
  test('Debug log sets context.log to the expected string', async () => {
    log.debug(context, 'FOO-NAMESPACE', 'test message');
    expect(mockLog).toHaveBeenCalledWith('[DEBUG] [FOO-NAMESPACE] test message');
  });
  test('Info log with an object passed to it, sets context.log to the expected string', async () => {
    const testObj = {
      property: 'value'
    }

    log.info(context, 'FOO-NAMESPACE', 'test message', testObj);
    expect(mockLog).toHaveBeenCalledWith(`[INFO] [FOO-NAMESPACE] test message ${JSON.stringify(testObj)}`);
  });
});
