import { Routes, Route } from 'react-router-dom';
import { Header } from './lib/components/Header';
import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
import { useAppInsights } from './lib/hooks/UseApplicationInsights';
import { createContext, useRef } from 'react';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import { getFeatureFlagConfiguration } from './configuration/featureFlagConfiguration';
import CaseDetailScreen from './case-detail/CaseDetailScreen';
import NotFound from './error/NotFound';
import ScrollToTopButton from './lib/components/ScrollToTopButton';
import DataVerificationScreen from './data-verification/DataVerificationScreen';
import useFeatureFlags, { TRANSFER_ORDERS_ENABLED } from './lib/hooks/UseFeatureFlags';
import SearchScreen from './search/SearchScreen';
import { PrivacyActFooter } from './lib/components/uswds/PrivacyActFooter';
import { MyCasesScreen } from './my-cases/MyCasesScreen';
import { StaffAssignmentScreen } from './staff-assignment/StaffAssignmentScreen';
import './App.scss';
import GlobalAlert, { GlobalAlertRef } from './lib/components/cams/GlobalAlert/GlobalAlert';
import { UswdsAlertStyle } from './lib/components/uswds/Alert';

const featureFlagConfig = getFeatureFlagConfiguration();
export const GlobalAlertContext = createContext<React.RefObject<GlobalAlertRef> | null>(null);

function App() {
  const { reactPlugin } = useAppInsights();
  const bodyElement = document.querySelector('.App');
  const flags = useFeatureFlags();

  const globalAlertRef = useRef<GlobalAlertRef>(null);

  /*
  function documentScroll(ev: React.UIEvent<HTMLElement>) {
    const scrollButton = document.querySelector('.scroll-to-top-button');
    console.log(scrollButton);
    if ((ev.currentTarget as Element).scrollTop > 100) {
      ev.currentTarget.className = 'App header-scrolled-out';
      //setAppClasses('App header-scrolled-out');
      // setScrollBtnClass('show');
      if (scrollButton) scrollButton.className = 'scroll-to-top-button show';
    } else {
      ev.currentTarget.className = 'App';
      //setAppClasses('App');
      // setScrollBtnClass('');
      if (scrollButton) scrollButton.className = 'scroll-to-top-button';
    }
  }
    */

  return (
    <AppInsightsErrorBoundary
      onError={(_error) => {
        return <h1>Something Went Wrong</h1>;
      }}
      appInsights={reactPlugin}
    >
      <div id="app-root" className="App" data-testid="app-component-test-id">
        <GlobalAlert inline={false} type={UswdsAlertStyle.Info} ref={globalAlertRef} />
        <Header />
        <GlobalAlertContext.Provider value={globalAlertRef}>
          <div className="cams-content">
            <Routes>
              <Route path="/search" element={<SearchScreen />}></Route>
              <Route path="/staff-assignment" element={<StaffAssignmentScreen />}></Route>
              <Route path="/search/:caseId" element={<SearchScreen />}></Route>
              <Route path="/my-cases" element={<MyCasesScreen />}></Route>
              <Route path="/case-detail/:caseId/*" element={<CaseDetailScreen />}></Route>
              {flags[TRANSFER_ORDERS_ENABLED] && (
                <Route path="/data-verification" element={<DataVerificationScreen />}></Route>
              )}
              <Route path="*" element={<NotFound />}></Route>
            </Routes>
            <ScrollToTopButton target={bodyElement} data-testid="scroll-to-top-button" />
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
