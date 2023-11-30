import './App.scss';
import { Routes, Route } from 'react-router-dom';
import { HeaderNavBar } from './lib/components/HeaderNavBar';
import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
import { reactPlugin } from './ApplicationInsightsService';
import { useState } from 'react';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import featureFlags from './configuration/featureFlagConfiguration';
import Home from './home/Home';
import CaseAssignment from './case-assignment/CaseAssignmentScreen';
import CaseDetail from './case-detail/CaseDetailScreen';
import NotFound from './error/NotFound';
import ScrollToTopButton from './lib/components/ScrollToTopButton';

function App() {
  const [appClasses, setAppClasses] = useState<string>('App');
  const [scrollBtnClass, setScrollBtnClass] = useState<string>('');
  const bodyElement = document.querySelector('.App');

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
      onError={(e) => {
        console.log(e);
        return <h1>Something Went Wrong</h1>;
      }}
      appInsights={reactPlugin}
    >
      <div className={appClasses} onScroll={documentScroll} data-testid="app-component-test-id">
        <HeaderNavBar />
        <div className="body">
          <Routes>
            <Route path="/" element={<Home />}></Route>
            <Route path="/case-assignment" element={<CaseAssignment />}></Route>
            <Route path="/case-detail/:caseId/*" element={<CaseDetail />}></Route>
            <Route path="*" element={<NotFound />}></Route>
          </Routes>
          <ScrollToTopButton className={scrollBtnClass} target={bodyElement} />
        </div>
      </div>
    </AppInsightsErrorBoundary>
  );
}

let AppToExport: React.ComponentType;
if (featureFlags.useExternalProvider) {
  AppToExport = withLDProvider({
    clientSideID: featureFlags.clientId,
    reactOptions: {
      useCamelCaseFlagKeys: featureFlags.useCamelCaseFlagKeys,
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
