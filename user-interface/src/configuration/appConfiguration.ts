export type CamsConfiguration = Partial<{
  CAMS_BASE_PATH: string;
  CAMS_SERVER_HOSTNAME: string;
  CAMS_SERVER_PORT: string;
  CAMS_SERVER_PROTOCOL: string;
  CAMS_FEATURE_FLAG_CLIENT_ID: string;
  CAMS_LAUNCH_DARKLY_ENV: string;
  CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING: string;
  CAMS_PA11Y: string;
  CAMS_DISABLE_LOCAL_CACHE: string;
  CAMS_INACTIVE_TIMEOUT: string;
  CAMS_LOGIN_PROVIDER: string;
  CAMS_LOGIN_PROVIDER_CONFIG: string;
}>;

const config = window.CAMS_CONFIGURATION;

function getAppConfiguration() {
  return {
    basePath: config.CAMS_BASE_PATH,
    serverHostName: config.CAMS_SERVER_HOSTNAME,
    serverPort: config.CAMS_SERVER_PORT,
    serverProtocol: config.CAMS_SERVER_PROTOCOL,
    featureFlagClientId: config.CAMS_FEATURE_FLAG_CLIENT_ID,
    launchDarklyEnv: config.CAMS_LAUNCH_DARKLY_ENV,
    applicationInsightsConnectionString: config.CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING,
    pa11y: config.CAMS_PA11Y?.toLowerCase() === 'true',
    disableLocalCache: config.CAMS_DISABLE_LOCAL_CACHE?.toLowerCase() === 'true',
    inactiveTimeout: config.CAMS_INACTIVE_TIMEOUT
      ? (parseInt(config.CAMS_INACTIVE_TIMEOUT) ?? undefined)
      : undefined,
    loginProvider: config.CAMS_LOGIN_PROVIDER,
    loginProviderConfig: config.CAMS_LOGIN_PROVIDER_CONFIG,
  };
}

export default getAppConfiguration;
