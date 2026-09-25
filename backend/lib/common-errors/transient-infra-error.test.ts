import { isTransientInfraError } from './transient-infra-error';
import { TooManyRequestsError } from './too-many-requests-error';
import { GatewayTimeoutError } from './gateway-timeout';
import { CamsError } from './cams-error';

describe('isTransientInfraError', () => {
  test('returns true for a TooManyRequestsError', () => {
    expect(isTransientInfraError(new TooManyRequestsError('COSMOS'))).toBe(true);
  });

  test('returns true for a GatewayTimeoutError', () => {
    expect(isTransientInfraError(new GatewayTimeoutError('COSMOS'))).toBe(true);
  });

  test('returns false for a non-transient error', () => {
    expect(isTransientInfraError(new CamsError('TEST', { message: 'permanent failure' }))).toBe(
      false,
    );
  });
});
