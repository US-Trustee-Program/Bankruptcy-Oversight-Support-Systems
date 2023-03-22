import 'jsdom-global/register';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { expect } from 'chai';
import { BrowserRouter } from 'react-router-dom';
import App from '../../src/App';

const rootContainer = document.createElement('div');
const root = ReactDOM.createRoot(rootContainer);

describe('Test default route', () => {
  it('Show display a list of cases', () => {
    root.render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    const h1 = rootContainer.querySelector('h1');
    if (h1) {
      expect(h1.textContent).to.equal('Case List');
    } else {
      return false;
    }
  });
});
