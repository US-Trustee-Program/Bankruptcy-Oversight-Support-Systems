import './App.scss';
import { Routes, Route } from 'react-router-dom';
import { Header } from './lib/components/uswds/Header';
import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
import { reactPlugin } from './ApplicationInsightsService';
import { useState } from 'react';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import { getFeatureFlagConfiguration } from './configuration/featureFlagConfiguration';
import Home from './home/Home';
import CaseAssignment from './case-assignment/CaseAssignmentScreen';
import CaseDetailScreen from './case-detail/CaseDetailScreen';
import NotFound from './error/NotFound';
import ScrollToTopButton from './lib/components/ScrollToTopButton';
import DataVerificationScreen from './data-verification/DataVerificationScreen';
import useFeatureFlags, { TRANSFER_ORDERS_ENABLED } from './lib/hooks/UseFeatureFlags';

const featureFlagConfig = getFeatureFlagConfiguration();

function App() {
  const [appClasses, setAppClasses] = useState<string>('App');
  const [scrollBtnClass, setScrollBtnClass] = useState<string>('');
  const bodyElement = document.querySelector('.App');
  const flags = useFeatureFlags();

  function documentScroll(ev: React.UIEvent<HTMLElement>) {
    if ((ev.currentTarget as Element).scrollTop > 100) {
      setAppClasses('App header-scrolled-out');
      setScrollBtnClass('show');
    } else {
      setAppClasses('App');
      setScrollBtnClass('');
    }
  }

  return (
    <AppInsightsErrorBoundary
      onError={(_error) => {
        return <h1>Something Went Wrong</h1>;
      }}
      appInsights={reactPlugin}
    >
      <div
        id="app-root"
        className={appClasses}
        onScroll={documentScroll}
        data-testid="app-component-test-id"
      >
        <Header />
        <div className="body">
          <Routes>
            <Route path="/" element={<Home />}></Route>
            <Route path="/case-assignment" element={<CaseAssignment />}></Route>
            <Route path="/case-detail/:caseId/*" element={<CaseDetailScreen />}></Route>
            {flags[TRANSFER_ORDERS_ENABLED] && (
              <Route path="/data-verification" element={<DataVerificationScreen />}></Route>
            )}
            <Route path="*" element={<NotFound />}></Route>
          </Routes>
          <ScrollToTopButton
            className={scrollBtnClass}
            target={bodyElement}
            data-testid="scroll-to-top-button"
          />
        </div>
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
