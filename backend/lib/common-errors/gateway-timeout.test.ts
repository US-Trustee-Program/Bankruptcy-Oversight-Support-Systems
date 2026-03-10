import { describe, expect, test } from 'vitest';
import { GatewayTimeoutError } from './gateway-timeout';
import HttpStatusCodes from '@common/api/http-status-codes';

describe('GatewayTimeoutError', () => {
  const moduleName = 'TEST_MODULE';

  test('should create error with default message when no options provided', () => {
    const error = new GatewayTimeoutError(moduleName);

    expect(error.module).toBe(moduleName);
    expect(error.message).toBe('Gateway Timeout');
    expect(error.status).toBe(HttpStatusCodes.GATEWAY_TIMEOUT);
    expect(error.isCamsError).toBe(true);
  });

  test('should create error with default message when empty options provided', () => {
    const error = new GatewayTimeoutError(moduleName, {});

    expect(error.module).toBe(moduleName);
    expect(error.message).toBe('Gateway Timeout');
    expect(error.status).toBe(HttpStatusCodes.GATEWAY_TIMEOUT);
    expect(error.isCamsError).toBe(true);
  });

  test('should create error with custom message when provided', () => {
    const customMessage = 'Custom gateway timeout message';
    const error = new GatewayTimeoutError(moduleName, { message: customMessage });

    expect(error.module).toBe(moduleName);
    expect(error.message).toBe(customMessage);
    expect(error.status).toBe(HttpStatusCodes.GATEWAY_TIMEOUT);
    expect(error.isCamsError).toBe(true);
  });
});
