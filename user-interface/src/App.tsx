import './App.scss';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import NotFound from './components/NotFound';
import { CaseList } from './components/CaseList';
import { CaseAssignment } from './components/CaseAssignment';
import { HeaderNavBar } from './components/HeaderNavBar';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { AppInsightsErrorBoundary } from '@microsoft/applicationinsights-react-js';
import { reactPlugin } from './ApplicationInsightsService';

function App() {
  return (
    <AppInsightsErrorBoundary
      onError={() => <h1>Something Went Wrong</h1>}
      appInsights={reactPlugin}
    >
      <div className="App">
        <Provider store={store}>
          <HeaderNavBar />
          <div className="body">
            <Routes>
              <Route path="/" element={<Home />}></Route>
              <Route path="/cases" element={<CaseList />}></Route>
              <Route path="/case-assignment" element={<CaseAssignment />}></Route>
              <Route path="*" element={<NotFound />}></Route>
            </Routes>
          </div>
        </Provider>
      </div>
    </AppInsightsErrorBoundary>
  );
}

export default App;
