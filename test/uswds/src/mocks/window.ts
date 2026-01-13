// Mock window.CAMS_CONFIGURATION for standalone showcase app
declare global {
  interface Window {
    CAMS_CONFIGURATION: {
      CAMS_BASE_PATH: string;
      CAMS_SERVER_HOSTNAME: string;
      CAMS_SERVER_PORT: string;
      CAMS_SERVER_PROTOCOL: string;
      CAMS_FEATURE_FLAG_CLIENT_ID: string;
      CAMS_LAUNCH_DARKLY_ENV: string;
      CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING: string;
      CAMS_USE_FAKE_API: string;
      CAMS_DISABLE_LOCAL_CACHE: string;
      CAMS_INACTIVE_TIMEOUT: string;
      CAMS_LOGIN_PROVIDER: string;
      CAMS_LOGIN_PROVIDER_CONFIG: string;
      launchDarklyEnv: string;
      sentryEnv: string;
      applicationInsightsConnectionString: string;
    };
  }
}

window.CAMS_CONFIGURATION = {
  CAMS_BASE_PATH: '/',
  CAMS_SERVER_HOSTNAME: 'localhost',
  CAMS_SERVER_PORT: '3000',
  CAMS_SERVER_PROTOCOL: 'http',
  CAMS_FEATURE_FLAG_CLIENT_ID: '',
  CAMS_LAUNCH_DARKLY_ENV: 'showcase',
  CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING: '',
  CAMS_USE_FAKE_API: 'true',
  CAMS_DISABLE_LOCAL_CACHE: 'false',
  CAMS_INACTIVE_TIMEOUT: '900000',
  CAMS_LOGIN_PROVIDER: 'none',
  CAMS_LOGIN_PROVIDER_CONFIG: '{}',
  launchDarklyEnv: 'showcase',
  sentryEnv: 'showcase',
  applicationInsightsConnectionString: '',
};

export {};
