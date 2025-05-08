// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthenticationRoutes } from './login/AuthenticationRoutes';

export type CamsConfiguration = {
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
};

declare global {
  interface Window {
    CAMS_CONFIGURATION: CamsConfiguration;
    CAMS_INFO_SHA?: string;
  }
}

async function initializeApp() {
  try {
    console.log('Fetching configuration.json...');
    const response = await fetch('/configuration.json');

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to fetch configuration.json: ${response.status} ${response.statusText}`,
        errorText,
      );
      throw new Error(
        `Failed to fetch configuration.json: ${response.status} ${response.statusText}. Server response: ${errorText}`,
      );
    }

    window.CAMS_CONFIGURATION = await response.json();
  } catch (error) {
    console.error('Error loading application configuration:', error);
    const rootElement = document.getElementById('root');
    const errorMessage = `Critical error: Failed to load application configuration. Please try again later or contact support. Details: ${error instanceof Error ? error.message : String(error)}`;
    if (rootElement) {
      rootElement.innerHTML = `<div style="padding: 20px; text-align: center; color: red;"><h3>${errorMessage}</h3></div>`;
    } else {
      document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red;"><h3>${errorMessage} (Root element not found)</h3></div>`;
    }
    return;
  }

  const rootElement = document.getElementById('root');

  if (!rootElement) {
    console.error('Fatal Error: Root element with ID "root" not found in the DOM.');
    document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red;"><h3>Fatal Error: Application mount point "root" not found.</h3></div>`;
    return;
  }

  const root = ReactDOM.createRoot(rootElement as HTMLElement);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthenticationRoutes>
          <App />
        </AuthenticationRoutes>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

initializeApp();
