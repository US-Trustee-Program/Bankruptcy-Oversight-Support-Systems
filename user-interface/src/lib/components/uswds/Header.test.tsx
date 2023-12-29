import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';

describe('Header', () => {
  vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'transfer-orders-enabled': true });

  test('should be rendered', async () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      </React.StrictMode>,
    );
    const mainTitle = await screen.findByText('U.S. Trustee Program');
    const subTitle = await screen.findByText('CAse Management System (CAMS)');
    const caseMenu = await screen.findByTestId('header-cases-link');

    expect(mainTitle).toBeInTheDocument();
    expect(subTitle).toBeInTheDocument();
    expect(caseMenu).toBeInTheDocument();
  });

  test('should highlight cases link when URL is /case-assignment', async () => {
    const casesUrl = '/case-assignment';

    render(
      <MemoryRouter initialEntries={[casesUrl]}>
        <Header />
      </MemoryRouter>,
    );

    const link = await screen.findByTestId('header-cases-link');
    expect(link).toBeInTheDocument();
    await waitFor(() => {
      expect(link).toHaveClass('usa-current current');
    });
  });

  test('should highlight cases link when URL is /case-detail', async () => {
    const casesUrl = '/case-detail';

    render(
      <MemoryRouter initialEntries={[casesUrl]}>
        <Header />
      </MemoryRouter>,
    );

    const link = await screen.findByTestId('header-cases-link');
    expect(link).toBeInTheDocument();
    await waitFor(() => {
      expect(link).toHaveClass('usa-current current');
    });
  });

  test('should highlight review orders link when URL is /review-orders', async () => {
    const casesUrl = '/review-orders';

    render(
      <MemoryRouter initialEntries={[casesUrl]}>
        <Header />
      </MemoryRouter>,
    );

    const link = await screen.findByTestId('header-review-orders-link');
    expect(link).toBeInTheDocument();
    await waitFor(() => {
      expect(link).toHaveClass('usa-current current');
    });
  });

  test('should not highlight any link when URL is /gibberish', async () => {
    const casesUrl = '/gibberish';

    render(
      <MemoryRouter initialEntries={[casesUrl]}>
        <Header />
      </MemoryRouter>,
    );

    const casesLink = await screen.findByTestId('header-cases-link');
    const reviewLink = await screen.findByTestId('header-review-orders-link');
    expect(casesLink).toBeInTheDocument();
    expect(reviewLink).toBeInTheDocument();

    await waitFor(() => {
      expect(casesLink).not.toHaveClass('usa-current current');
      expect(reviewLink).not.toHaveClass('usa-current current');
    });
  });

  test('should activate review orders link when clicked', async () => {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      </React.StrictMode>,
    );

    const linkToClick = await screen.findByTestId('header-review-orders-link');
    fireEvent.click(linkToClick);

    const casesLink = await screen.findByTestId('header-cases-link');
    expect(casesLink).toBeInTheDocument();
    expect(casesLink).not.toHaveClass('usa-current current');

    const ordersLink = await screen.findByTestId('header-review-orders-link');
    expect(ordersLink).toBeInTheDocument();
    expect(ordersLink).toHaveClass('usa-current current');
  });
});
