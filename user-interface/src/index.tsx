import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import Login from './login/Login';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <Login>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Login>
  </React.StrictMode>,
);
