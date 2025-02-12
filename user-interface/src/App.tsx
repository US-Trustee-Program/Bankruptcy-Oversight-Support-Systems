import { Routes, Route } from 'react-router-dom';
import { Header } from './lib/components/Header';
import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
import { useAppInsights } from './lib/hooks/UseApplicationInsights';
import { createContext, useEffect, useRef, useState } from 'react';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import { getFeatureFlagConfiguration } from './configuration/featureFlagConfiguration';
import CaseDetailScreen from './case-detail/CaseDetailScreen';
import ScrollToTopButton from './lib/components/ScrollToTopButton';
import DataVerificationScreen from './data-verification/DataVerificationScreen';
import useFeatureFlags, {
  PRIVILEGED_IDENTITY_MANAGEMENT,
  TRANSFER_ORDERS_ENABLED,
} from './lib/hooks/UseFeatureFlags';
import SearchScreen from './search/SearchScreen';
import { PrivacyActFooter } from './lib/components/uswds/PrivacyActFooter';
import { MyCasesScreen } from './my-cases/MyCasesScreen';
import { StaffAssignmentScreen } from './staff-assignment/screen/StaffAssignmentScreen';
import './App.scss';
import GlobalAlert, { GlobalAlertRef } from './lib/components/cams/GlobalAlert/GlobalAlert';
import { UswdsAlertStyle } from './lib/components/uswds/Alert';
import { AdminScreen } from './admin/AdminScreen';
import { GoHome } from './lib/components/GoHome';
import { LoadingSpinner } from './lib/components/LoadingSpinner';

const featureFlagConfig = getFeatureFlagConfiguration();
export const GlobalAlertContext = createContext<React.RefObject<GlobalAlertRef> | null>(null);

function App() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { reactPlugin } = useAppInsights();
  const flags = useFeatureFlags();

  const globalAlertRef = useRef<GlobalAlertRef>(null);
  const [transfersEnabled, setTransfersEnabled] = useState<boolean>(false);
  const [privilegedIdentityEnabled, setPrivilegedIdentityEnabled] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(false);
  }, [Object.keys(flags).length > 0]);

  useEffect(() => {
    setTransfersEnabled(true);
  }, [flags[TRANSFER_ORDERS_ENABLED] === true]);

  useEffect(() => {
    setPrivilegedIdentityEnabled(true);
  }, [flags[PRIVILEGED_IDENTITY_MANAGEMENT] === true]);

  return (
    <>
      {isLoading && <LoadingSpinner id="app-loading-spinner" caption="Loading application..." />}
      {!isLoading && (
        <AppInsightsErrorBoundary
          onError={(_error) => {
            return <h1 data-testid="error-boundary-message">Something Went Wrong</h1>;
          }}
          appInsights={reactPlugin}
        >
          <div id="app-root" className="App" data-testid="app-component-test-id">
            <GlobalAlert inline={false} type={UswdsAlertStyle.Info} ref={globalAlertRef} />
            <Header />
            <GlobalAlertContext.Provider value={globalAlertRef}>
              <div className="cams-content">
                <Routes>
                  <Route path="/my-cases" element={<MyCasesScreen />}></Route>
                  <Route path="/search" element={<SearchScreen />}></Route>
                  <Route path="/staff-assignment" element={<StaffAssignmentScreen />}></Route>
                  <Route path="/search/:caseId" element={<SearchScreen />}></Route>
                  <Route path="/case-detail/:caseId/*" element={<CaseDetailScreen />}></Route>
                  {transfersEnabled && (
                    <Route path="/data-verification" element={<DataVerificationScreen />}></Route>
                  )}
                  {privilegedIdentityEnabled && (
                    <Route path="/admin/*" element={<AdminScreen />}></Route>
                  )}
                  <Route index element={<GoHome />}></Route>
                  <Route path="*" element={<GoHome />}></Route>
                </Routes>
                <ScrollToTopButton data-testid="scroll-to-top-button" />
              </div>
            </GlobalAlertContext.Provider>
            <PrivacyActFooter></PrivacyActFooter>
          </div>
        </AppInsightsErrorBoundary>
      )}
    </>
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
