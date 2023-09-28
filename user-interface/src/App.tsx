import './App.scss';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import NotFound from './components/NotFound';
import { CaseAssignment } from './components/CaseAssignment';
import { CaseDetail } from './components/CaseDetail';
import { HeaderNavBar } from './components/HeaderNavBar';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
import { reactPlugin } from './ApplicationInsightsService';
import { useState } from 'react';

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
    <AppInsightsErrorBoundary
      onError={() => <h1>Something Went Wrong</h1>}
      appInsights={reactPlugin}
    >
      <div className={appClasses}>
        <Provider store={store}>
          <HeaderNavBar />
          <div className="body">
            <Routes>
              <Route path="/" element={<Home />}></Route>
              <Route path="/case-assignment" element={<CaseAssignment />}></Route>
              <Route path="/case-detail/:caseNumber" element={<CaseDetail />}></Route>
              <Route path="*" element={<NotFound />}></Route>
            </Routes>
          </div>
        </Provider>
      </div>
    </AppInsightsErrorBoundary>
  );
}

export default App;
