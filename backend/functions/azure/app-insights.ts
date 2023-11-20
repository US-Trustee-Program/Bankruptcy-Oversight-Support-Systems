export function initializeApplicationInsights() {
  if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    const appInsights = require('applicationinsights');
    appInsights.setup().start();
  }
}
