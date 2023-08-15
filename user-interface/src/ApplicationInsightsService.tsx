import { ApplicationInsights, ITelemetryItem } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

const appInsightsConnectionString =
  'InstrumentationKey=340f749a-f435-fa6a-96c6-acf683a99a18;EndpointSuffix=applicationinsights.us;IngestionEndpoint=https://usgovvirginia-1.in.applicationinsights.azure.us/;AADAudience=https://monitor.azure.us/'; // TODO : Testing instrumentation with temporary environment
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
  },
});

if (appInsightsConnectionString) {
  appInsights.loadAppInsights();

  appInsights.addTelemetryInitializer((env: ITelemetryItem) => {
    env.tags = env.tags || [];
    env.tags['component'] = 'ustp.cams.webapp'; // test tag
  });
}

export { reactPlugin, appInsights };
