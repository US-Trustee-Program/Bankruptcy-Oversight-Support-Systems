import { ApplicationInsights, ITelemetryItem } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';
import getAppConfiguration from '@/configuration/appConfiguration';

const appInsightsConnectionString = getAppConfiguration().applicationInsightsConnectionString;
const reactPlugin = new ReactPlugin();

const appInsights = new ApplicationInsights({
  config: {
    connectionString: appInsightsConnectionString,
    extensions: [reactPlugin],
    extensionConfig: {},
    enableAutoRouteTracking: true,
    disableAjaxTracking: false,
    disableExceptionTracking: false,
    autoTrackPageVisitTime: true,
    enableCorsCorrelation: true,
    enableRequestHeaderTracking: true,
    enableResponseHeaderTracking: true,
    enableDebug: true,
    maxAjaxCallsPerView: 2000,
    correlationHeaderExcludedDomains: ['launchdarkly.us'],
  },
});

if (appInsightsConnectionString) {
  appInsights.addTelemetryInitializer((env: ITelemetryItem) => {
    env.tags = env.tags || [];
    env.tags['ai.cloud.role'] = 'ustp.cams.web';
  });

  appInsights.loadAppInsights();

  appInsights.trackEvent(
    { name: 'Viewport Size' },
    { width: window.innerWidth, height: window.innerHeight },
  );
}

export function getAppInsights() {
  return { reactPlugin, appInsights };
}
