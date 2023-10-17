import { getFeatureFlags } from './feature-flag';
import { ApplicationConfiguration } from '../../configs/application-configuration';

let config;

jest.mock('@launchdarkly/node-server-sdk', () => {
  return {
    init: jest.fn().mockReturnValue({
      allFlagsState: jest.fn().mockReturnValue({
        allValues: jest.fn().mockReturnValue({
          'chapter-twelve-enabled': true,
        }),
      }),
      flush: jest.fn(),
      close: jest.fn(),
      waitForInitialization: jest.fn(),
    }),
  };
});

describe('Tests for feature flags', () => {
  const env = process.env;
  beforeAll(() => {
    process.env = {
      ...env,
      FEATURE_FLAG_SDK_KEY: 'fake-key',
    };
    config = new ApplicationConfiguration();
  });

  test('Should foo', async () => {
    const flags = await getFeatureFlags(config);
    console.log('Testing flags', flags);
    expect(flags['chapter-twelve-enabled']).toEqual(true);
  });
});
