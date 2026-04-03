/// <reference types="vite/client" />

interface CamsConfiguration {
  CAMS_BASE_PATH?: string;
  CAMS_SERVER_HOSTNAME?: string;
  CAMS_SERVER_PORT?: string;
  CAMS_SERVER_PROTOCOL?: string;
  CAMS_FEATURE_FLAG_CLIENT_ID?: string;
  CAMS_FEATURE_FLAGS_MODE?: string;
  CAMS_LAUNCH_DARKLY_ENV?: string;
  CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING?: string;
  CAMS_USE_FAKE_API?: string;
  CAMS_DISABLE_LOCAL_CACHE?: string;
  CAMS_INACTIVE_TIMEOUT?: string;
  CAMS_LOGIN_PROVIDER?: string;
  CAMS_LOGIN_PROVIDER_CONFIG?: string;
  CAMS_PA11Y?: string;
}

declare global {
  interface Window {
    CAMS_CONFIGURATION: CamsConfiguration;
  }
}
