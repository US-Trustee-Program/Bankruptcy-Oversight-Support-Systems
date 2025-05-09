function getAppConfiguration() {
  const config = window.CAMS_CONFIGURATION;
  return {
    basePath: config?.CAMS_BASE_PATH,
    serverHostName: config?.CAMS_SERVER_HOSTNAME,
    serverPort: config?.CAMS_SERVER_PORT,
    serverProtocol: config?.CAMS_SERVER_PROTOCOL,
    featureFlagClientId: config?.CAMS_FEATURE_FLAG_CLIENT_ID,
    launchDarklyEnv: config?.CAMS_LAUNCH_DARKLY_ENV,
    applicationInsightsConnectionString: config?.CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING,
    pa11y: config?.CAMS_PA11Y?.toLowerCase() === 'true',
    disableLocalCache: config?.CAMS_DISABLE_LOCAL_CACHE?.toLowerCase() === 'true',
    inactiveTimeout: config?.CAMS_INACTIVE_TIMEOUT
      ? (parseInt(config?.CAMS_INACTIVE_TIMEOUT) ?? undefined)
      : undefined,
    loginProvider: config?.CAMS_LOGIN_PROVIDER,
    loginProviderConfig: config?.CAMS_LOGIN_PROVIDER_CONFIG,
  };
}

export default getAppConfiguration;
export type AppConfiguration = ReturnType<typeof getAppConfiguration>;
