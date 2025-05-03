import { ReactPlugin } from '@microsoft/applicationinsights-react-js';
import { ApplicationInsights, ITelemetryItem } from '@microsoft/applicationinsights-web';

const appInsightsConnectionString = import.meta.env['CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING'];
const reactPlugin = new ReactPlugin();

const appInsights = new ApplicationInsights({
  config: {
    autoTrackPageVisitTime: true,
    connectionString: appInsightsConnectionString,
    correlationHeaderExcludedDomains: ['launchdarkly.us'],
    disableAjaxTracking: false,
    disableExceptionTracking: false,
    enableAutoRouteTracking: true,
    enableCorsCorrelation: true,
    enableDebug: true,
    enableRequestHeaderTracking: true,
    enableResponseHeaderTracking: true,
    extensionConfig: {},
    extensions: [reactPlugin],
  },
});

if (appInsightsConnectionString) {
  appInsights.loadAppInsights();

  appInsights.addTelemetryInitializer((env: ITelemetryItem) => {
    env.tags = env.tags || [];
    env.tags['ai.cloud.role'] = 'ustp.cams.web';
  });
}

export function useAppInsights() {
  return { appInsights, reactPlugin };
}
