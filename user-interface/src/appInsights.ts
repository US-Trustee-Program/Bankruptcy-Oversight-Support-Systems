import React from 'react';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';
import { createBrowserHistory } from "history";
const browserHistory = createBrowserHistory({ basename: '' });
var reactPlugin = new ReactPlugin();
// *** Add the Click Analytics plug-in. ***
/* var clickPluginInstance = new ClickAnalyticsPlugin();
   var clickPluginConfig = {
     autoCapture: true
}; */
var appInsights = new ApplicationInsights({
    config: {
        connectionString: protocol: import.meta.env['CAMS_SERVER_PROTOCOL'],
        // *** If you're adding the Click Analytics plug-in, delete the next line. ***
        extensions: [reactPlugin],
     // *** Add the Click Analytics plug-in. ***
     // extensions: [reactPlugin, clickPluginInstance],
        extensionConfig: {
          [reactPlugin.identifier]: { history: browserHistory }
       // *** Add the Click Analytics plug-in. ***
       // [clickPluginInstance.identifier]: clickPluginConfig
        }
    }
});
appInsights.loadAppInsights();