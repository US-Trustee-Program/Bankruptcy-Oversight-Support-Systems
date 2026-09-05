import { Routes, Route } from 'react-router-dom';
import { Header } from './lib/components/Header';
import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
import { getAppInsights } from './lib/hooks/UseApplicationInsights';
import { createContext, useEffect, useRef } from 'react';
import { useLDClient, withLDProvider } from 'launchdarkly-react-client-sdk';
import { buildLaunchDarklyContext } from '@common/feature-flags';
import { getFeatureFlagConfiguration } from './configuration/featureFlagConfiguration';
import LocalStorage from './lib/utils/local-storage';
import CaseDetailScreen from './case-detail/CaseDetailScreen';
import ScrollToTopButton from './lib/components/ScrollToTopButton';
import DataVerificationScreen from './data-verification/DataVerificationScreen';
import SearchScreen from './search/SearchScreen';
import { PrivacyActFooter } from './lib/components/uswds/PrivacyActFooter';
import { MyCasesScreen } from './my-cases/MyCasesScreen';
import StaffAssignmentScreen from './staff-assignment/screen/StaffAssignmentScreen';
import GlobalAlert, { GlobalAlertRef } from './lib/components/cams/GlobalAlert/GlobalAlert';
import { UswdsAlertStyle } from './lib/components/uswds/Alert';
import { AdminScreen } from './admin/AdminScreen';
import { GoHome } from './lib/components/GoHome';
import TrusteesScreen from './trustees/TrusteesScreen';
import TrusteeDetailScreen from './trustees/TrusteeDetailScreen';
import { AddTrusteeRouteGuard } from './trustees/AddTrusteeRouteGuard';
import SessionTimeoutManager from './lib/components/cams/SessionTimeoutManager/SessionTimeoutManager';
import { NavigationTracker } from './lib/components/NavigationTracker';

const featureFlagConfig = getFeatureFlagConfiguration();
export const GlobalAlertContext = createContext<React.RefObject<GlobalAlertRef | null> | null>(
  null,
);

function App() {
  const { reactPlugin } = getAppInsights();
  const globalAlertRef = useRef<GlobalAlertRef>(null);
  const ldClient = useLDClient();

  // Identifies once, on mount. `Session.tsx` blocks rendering `App` until the full
  // session is resolved, so this always reflects the logged-in user. A re-login as
  // a different user without a full remount would not re-identify.
  useEffect(() => {
    const session = LocalStorage.getSession();
    if (session?.user && ldClient) {
      ldClient.identify(buildLaunchDarklyContext(session.user));
    }
  }, [ldClient]);

  return (
    <AppInsightsErrorBoundary
      onError={(_error) => {
        return <h1 data-testid="error-boundary-message">Something Went Wrong</h1>;
      }}
      appInsights={reactPlugin}
    >
      <div id="app-root" className="App" data-testid="app-component-test-id">
        <GlobalAlert inline={false} type={UswdsAlertStyle.Info} ref={globalAlertRef} />
        <Header />
        <NavigationTracker />
        <GlobalAlertContext.Provider value={globalAlertRef}>
          <div className="cams-content">
            <Routes>
              <Route path="/my-cases" element={<MyCasesScreen />}></Route>
              <Route path="/search" element={<SearchScreen />}></Route>
              <Route path="/staff-assignment" element={<StaffAssignmentScreen />}></Route>
              <Route path="/search/:caseId" element={<SearchScreen />}></Route>
              <Route path="/case-detail/:caseId/*" element={<CaseDetailScreen />}></Route>
              <Route path="/data-verification" element={<DataVerificationScreen />}></Route>
              <Route path="/admin/*" element={<AdminScreen />}></Route>
              <Route path="/trustees/:trusteeId/*" element={<TrusteeDetailScreen />}></Route>
              <Route path="/trustees" element={<TrusteesScreen />}>
                <Route path="create" element={<AddTrusteeRouteGuard />} />
              </Route>
              <Route index element={<GoHome />}></Route>
              <Route path="*" element={<GoHome />}></Route>
            </Routes>
            <SessionTimeoutManager />
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
    reactOptions: {
      useCamelCaseFlagKeys: featureFlagConfig.useCamelCaseFlagKeys,
    },
    options: {
      baseUrl: 'https://clientsdk.launchdarkly.us',
      streamUrl: 'https://clientstream.launchdarkly.us',
      eventsUrl: 'https://events.launchdarkly.us',
    },
  })(App);
} else {
  AppToExport = App;
}

export default AppToExport;
