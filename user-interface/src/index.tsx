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
  CAMS_PA11Y: string;
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

if (rootElement) {
  ReactDOM.createRoot(rootElement as HTMLElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthenticationRoutes>
          <App />
        </AuthenticationRoutes>
      </BrowserRouter>
    </React.StrictMode>,
  );
  console.log('CAMS Application mounted.');
} else {
  console.error('Fatal Error: Root element with ID "root" not found in the DOM.');
  document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red;"><h3>Fatal Error: Application mount point "root" not found.</h3></div>`;
}
