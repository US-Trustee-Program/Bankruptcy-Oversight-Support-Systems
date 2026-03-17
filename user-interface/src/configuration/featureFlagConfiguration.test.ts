import { getFeatureFlagConfiguration } from './featureFlagConfiguration';
import { mockConfiguration } from '@/lib/testing/mock-configuration';

describe('featureFlagConfiguration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns empty clientId and useExternalProvider false when featureFlagClientId is undefined', () => {
    mockConfiguration({ featureFlagClientId: undefined });

    const config = getFeatureFlagConfiguration();
    expect(config.clientId).toBe('');
    expect(config.useExternalProvider).toBe(false);
  });

  test('returns clientId and useExternalProvider true when featureFlagClientId is set', () => {
    mockConfiguration({ featureFlagClientId: 'test-client-id' });

    const config = getFeatureFlagConfiguration();
    expect(config.clientId).toBe('test-client-id');
    expect(config.useExternalProvider).toBe(true);
  });
});
