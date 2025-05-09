import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthenticationRoutes } from './login/AuthenticationRoutes';

export type CamsConfiguration = Partial<{
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
}>;

declare global {
  interface Window {
    CAMS_CONFIGURATION: CamsConfiguration;
    CAMS_INFO_SHA?: string;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Unable to start CAMS application. Please try again later. If the problem persists, please contact USTP support.',
  );
}

ReactDOM.createRoot(rootElement as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthenticationRoutes>
        <App />
      </AuthenticationRoutes>
    </BrowserRouter>
  </React.StrictMode>,
);
