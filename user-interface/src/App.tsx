import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import { createContext, useRef } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AdminScreen } from './admin/AdminScreen';
import CaseDetailScreen from './case-detail/CaseDetailScreen';
import { getFeatureFlagConfiguration } from './configuration/featureFlagConfiguration';
import DataVerificationScreen from './data-verification/DataVerificationScreen';
import GlobalAlert, { GlobalAlertRef } from './lib/components/cams/GlobalAlert/GlobalAlert';
import { GoHome } from './lib/components/GoHome';
import { Header } from './lib/components/Header';
import ScrollToTopButton from './lib/components/ScrollToTopButton';
import { UswdsAlertStyle } from './lib/components/uswds/Alert';
import { PrivacyActFooter } from './lib/components/uswds/PrivacyActFooter';
import './App.scss';
import { useAppInsights } from './lib/hooks/UseApplicationInsights';
import { MyCasesScreen } from './my-cases/MyCasesScreen';
import SearchScreen from './search/SearchScreen';
import StaffAssignmentScreen from './staff-assignment/screen/StaffAssignmentScreen';

const featureFlagConfig = getFeatureFlagConfiguration();
export const GlobalAlertContext = createContext<null | React.RefObject<GlobalAlertRef>>(null);

function App() {
  const { reactPlugin } = useAppInsights();
  const globalAlertRef = useRef<GlobalAlertRef>(null);

  return (
    <AppInsightsErrorBoundary
      appInsights={reactPlugin}
      onError={(_error) => {
        return <h1 data-testid="error-boundary-message">Something Went Wrong</h1>;
      }}
    >
      <div className="App" data-testid="app-component-test-id" id="app-root">
        <GlobalAlert inline={false} ref={globalAlertRef} type={UswdsAlertStyle.Info} />
        <Header />
        <GlobalAlertContext.Provider value={globalAlertRef}>
          <div className="cams-content">
            <Routes>
              <Route element={<MyCasesScreen />} path="/my-cases"></Route>
              <Route element={<SearchScreen />} path="/search"></Route>
              <Route element={<StaffAssignmentScreen />} path="/staff-assignment"></Route>
              <Route element={<SearchScreen />} path="/search/:caseId"></Route>
              <Route element={<CaseDetailScreen />} path="/case-detail/:caseId/*"></Route>
              <Route element={<DataVerificationScreen />} path="/data-verification"></Route>
              <Route element={<AdminScreen />} path="/admin/*"></Route>
              <Route element={<GoHome />} index></Route>
              <Route element={<GoHome />} path="*"></Route>
            </Routes>
            <ScrollToTopButton data-testid="scroll-to-top-button" />
          </div>
        </GlobalAlertContext.Provider>
        <PrivacyActFooter></PrivacyActFooter>
      </div>
    </AppInsightsErrorBoundary>
  );
}

let AppToExport: React.ComponentType;
if (featureFlagConfig.useExternalProvider) {
  AppToExport = withLDProvider({
    clientSideID: featureFlagConfig.clientId,
    options: {
      baseUrl: 'https://clientsdk.launchdarkly.us',
      eventsUrl: 'https://events.launchdarkly.us',
      streamUrl: 'https://clientstream.launchdarkly.us',
    },
    reactOptions: {
      useCamelCaseFlagKeys: featureFlagConfig.useCamelCaseFlagKeys,
    },
  })(App);
} else {
  AppToExport = App;
}

export default AppToExport;
