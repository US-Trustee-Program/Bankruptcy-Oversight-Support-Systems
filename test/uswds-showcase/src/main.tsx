import './mocks/window';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@uswds/uswds/css/uswds.min.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
