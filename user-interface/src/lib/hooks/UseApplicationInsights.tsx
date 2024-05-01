import { ApplicationInsights, ITelemetryItem } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

const appInsightsConnectionString = import.meta.env['CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING'];
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
    correlationHeaderExcludedDomains: ['launchdarkly.us'],
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
  return { reactPlugin, appInsights };
}

/*
import { useAppInsightsContext, useTrackEvent } from '@microsoft/applicationinsights-react-js';

const appInsights = useAppInsightsContext();
const trackSearchEvent = useTrackEvent(foo, 'search', '', true);
*/
