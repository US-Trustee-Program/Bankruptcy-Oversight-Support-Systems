import { describe, test, expect } from 'vitest';
import { isAcmsTimeoutError } from './acms-timeout-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';

describe('isAcmsTimeoutError', () => {
  test.each([
    {
      description: 'a Timeout message',
      error: new Error('Timeout: request exceeded limit'),
      expected: true,
    },
    {
      description: 'a RequestError message',
      error: new Error('RequestError: connection refused'),
      expected: true,
    },
    {
      description: 'the GatewayTimeoutError a DXTR query throws when mssql reports ETIMEOUT',
      error: new GatewayTimeoutError('CASES-DXTR-GATEWAY', {
        message: 'Timeout: Request failed to complete in 300000ms',
      }),
      expected: true,
    },
    { description: 'an unrelated Error', error: new Error('Some other error'), expected: false },
    { description: 'a non-Error value', error: 'Timeout', expected: false },
  ])('returns $expected for $description', ({ error, expected }) => {
    expect(isAcmsTimeoutError(error)).toBe(expected);
  });
});
