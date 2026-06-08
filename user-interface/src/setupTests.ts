import '@testing-library/jest-dom';
import dotenv from 'dotenv';
import { vi } from 'vitest';

dotenv.config();
const camsConfiguration: Record<string, string> = {};

Object.keys(process.env)
  .filter((key) => key.startsWith('CAMS_'))
  .forEach((varName) => {
    if (process.env[varName] !== undefined) {
      camsConfiguration[varName] = process.env[varName];
    }
  });

camsConfiguration.CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING = '';
camsConfiguration.CAMS_DISABLE_LOCAL_CACHE = 'false';

window.CAMS_CONFIGURATION = camsConfiguration;

// Ensure window.location is always available with proper defaults
if (!window.location) {
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/',
      search: '',
      hash: '',
    },
    writable: true,
    configurable: true,
  });
}

// Block real HTTP requests — all fetch calls must be mocked at the Api2 or http.adapter layer.
// If you see this error, add a vi.spyOn(Api2, '...').mockResolvedValue(...) to your test.
vi.stubGlobal('fetch', () => {
  throw new Error('Unmocked fetch call — stub Api2 or http.adapter in your test');
});

// Clean up timers after each test to prevent them from running after jsdom teardown
afterEach(() => {
  vi.clearAllTimers();
});
