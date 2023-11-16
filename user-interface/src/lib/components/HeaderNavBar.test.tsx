import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';

describe('App', () => {
  it('loads a page', async () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    );
    const mainTitle = await screen.findByText('U.S. Trustee Program');
    const subTitle = await screen.findByText('CAse Management System (CAMS)');
    const caseMenu = await screen.findByTestId('main-nav-case-assignment-link');

    expect(mainTitle).toBeInTheDocument();
    expect(subTitle).toBeInTheDocument();
    expect(caseMenu).toBeInTheDocument();
  });
});
