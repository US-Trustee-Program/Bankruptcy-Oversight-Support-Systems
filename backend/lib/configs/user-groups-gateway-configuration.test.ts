import { describe, expect, test } from 'vitest';
import { getUserGroupGatewayConfig } from './user-groups-gateway-configuration';

describe('user-groups-gateway-configuration', () => {
  test('should return a valid configuration object', () => {
    const config = getUserGroupGatewayConfig();

    // Config should be defined and return consistently
    expect(config).toBeDefined();

    // Call again to ensure it returns the same object
    const config2 = getUserGroupGatewayConfig();
    expect(config2).toEqual(config);
  });
});
