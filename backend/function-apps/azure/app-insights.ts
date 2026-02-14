export function initializeApplicationInsights() {
  if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');
    appInsights.setup().start();
  }
}

export function getAppInsightsClient(): unknown | null {
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');
    return appInsights.defaultClient ?? null;
  } catch {
    return null;
  }
}
