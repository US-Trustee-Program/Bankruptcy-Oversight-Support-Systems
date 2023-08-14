import { ApplicationInsights, ITelemetryItem } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

const appInsightsConnectionString = import.meta.env['APPLICATIONINSIGHTS_CONNECTION_STRING']; // TODO : NEED TO VERIFY THIS SNIPPET
const reactPlugin = new ReactPlugin();

const appInsights = new ApplicationInsights({
  config: {
    connectionString: appInsightsConnectionString,
    extensions: [reactPlugin],
    extensionConfig: {},
    enableAutoRouteTracking: true,
    disableAjaxTracking: false,
    autoTrackPageVisitTime: true,
    enableCorsCorrelation: true,
    enableRequestHeaderTracking: true,
    enableResponseHeaderTracking: true,
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
