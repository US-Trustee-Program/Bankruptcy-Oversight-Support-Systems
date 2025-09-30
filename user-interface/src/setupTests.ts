import '@testing-library/jest-dom';
import dotenv from 'dotenv';

dotenv.config();

// Robust polling solution: Wait for window to be available with timeout
// This addresses the root cause of "window is not defined" timing errors
// Configurable timing parameters for different environments
const WINDOW_TIMEOUT_MS = parseInt(process.env.VITEST_WINDOW_TIMEOUT_MS || '5000', 10);
const WINDOW_POLL_INTERVAL_MS = parseInt(process.env.VITEST_WINDOW_POLL_INTERVAL_MS || '10', 10);

function waitForWindowSync(
  timeoutMs = WINDOW_TIMEOUT_MS,
  pollIntervalMs = WINDOW_POLL_INTERVAL_MS,
): void {
  const startTime = Date.now();

  // Synchronous polling loop
  while (Date.now() - startTime < timeoutMs) {
    if (typeof window !== 'undefined' && window.document) {
      return; // Success!
    }

    // Synchronous delay using busy wait (only for short intervals)
    const delayStart = Date.now();
    while (Date.now() - delayStart < pollIntervalMs) {
      // Busy wait for short polling interval
    }
  }

  // Timeout exceeded - provide comprehensive diagnostic information
  const error = new Error(
    `Window object not available after ${timeoutMs}ms timeout. ` +
      `This suggests a jsdom environment initialization timing issue. ` +
      `Check vitest configuration: environment should be "jsdom". ` +
      `Current global objects: ${Object.keys(globalThis).join(', ')}`,
  );
  console.error('SETUP TIMEOUT:', error.message);
  console.error('Environment check: typeof window =', typeof window);
  console.error('Global this keys:', Object.keys(globalThis));
  throw error;
}

// Use synchronous polling to wait for window availability
waitForWindowSync();

// Now safely initialize CAMS configuration
const camsConfiguration: Record<string, string> = {};

Object.keys(process.env)
  .filter((key) => key.startsWith('CAMS_'))
  .forEach((varName) => {
    if (process.env[varName] !== undefined) {
      camsConfiguration[varName] = process.env[varName]!;
    }
  });

camsConfiguration.CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING = '';
camsConfiguration.CAMS_DISABLE_LOCAL_CACHE = 'false';

window.CAMS_CONFIGURATION = camsConfiguration;
