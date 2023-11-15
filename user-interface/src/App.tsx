import './App.scss';
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
const Home = lazy(() => import('@/home/Home'));
const NotFound = lazy(() => import('@/error/NotFound'));
const CaseAssignment = lazy(() => import('@/case-assignment/CaseAssignmentScreen'));
const CaseDetail = lazy(() => import('@/case-detail/CaseDetailScreen'));
import { HeaderNavBar } from './lib/components/HeaderNavBar';
//import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
//import { reactPlugin } from './ApplicationInsightsService';
import { useState } from 'react';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import featureFlags from './configuration/featureFlagConfiguration';
const LoadingIndicator = lazy(() => import('@/lib/components/LoadingIndicator'));

function App() {
  const [appClasses, setAppClasses] = useState<string>('App');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      setAppClasses('App header-scrolled-out');
    } else {
      setAppClasses('App');
    }
  });

  return (
    <div className={appClasses}>
      <HeaderNavBar />
      <div className="body">
        <Suspense fallback={<LoadingIndicator />}>
          <Routes>
            <Route path="/" element={<Home />}></Route>
            <Route path="/case-assignment" element={<CaseAssignment />}></Route>
            <Route path="/case-detail/:caseId/*" element={<CaseDetail />}></Route>
            <Route path="*" element={<NotFound />}></Route>
          </Routes>
        </Suspense>
      </div>
    </div>
    /*
    <AppInsightsErrorBoundary
      onError={(e) => {
        console.log(e);
        return <h1>Something Went Wrong</h1>;
      }}
      appInsights={reactPlugin}
    >
      <div className={appClasses}>
        <HeaderNavBar />
        <div className="body">
          <Suspense fallback={<LoadingIndicator />}>
            <Routes>
              <Route path="/" element={<Home />}></Route>
              <Route path="/case-assignment" element={<CaseAssignment />}></Route>
              <Route path="/case-detail/:caseId/*" element={<CaseDetail />}></Route>
              <Route path="*" element={<NotFound />}></Route>
            </Routes>
          </Suspense>
        </div>
      </div>
    </AppInsightsErrorBoundary>
    */
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
