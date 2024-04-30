import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';

describe('Header', () => {
  vi.spyOn(FeatureFlags, 'default').mockReturnValue({
    'transfer-orders-enabled': true,
    'case-search-enabled': true,
  });

  function renderWithoutProps() {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      </React.StrictMode>,
    );
  }

  function renderWithHistory(url: string) {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Header />
      </MemoryRouter>,
    );
  }

  test('should be rendered', async () => {
    renderWithoutProps();
    const mainTitle = await screen.findByText('U.S. Trustee Program');
    const subTitle = await screen.findByText('CAse Management System (CAMS)');
    const caseMenu = await screen.findByTestId('header-cases-link');

    expect(mainTitle).toBeInTheDocument();
    expect(subTitle).toBeInTheDocument();
    expect(caseMenu).toBeInTheDocument();
  });

  const highlightTestCases = [
    ['case assignment', '/case-assignment', 'header-cases-link'],
    ['case detail', '/case-detail', 'header-cases-link'],
    ['data verification', '/data-verification', 'header-data-verification-link'],
    ['search', '/search', 'header-search-link'],
  ];
  test.each(highlightTestCases)(
    'should highlight the %s link',
    async (_caseName: string, url: string, linkTestId: string) => {
      renderWithHistory(url);

      const link = await screen.findByTestId(linkTestId);
      expect(link).toBeInTheDocument();
      await waitFor(() => {
        expect(link).toHaveClass('usa-current current');
      });

      const current = document.querySelectorAll('.usa-current.current');
      expect(current).toHaveLength(1);
    },
  );

  test('should not highlight any link when URL is /gibberish', async () => {
    renderWithHistory('/gibberish');

    const current = document.querySelectorAll('.usa-current .current');
    expect(current).toHaveLength(0);
  });

  const linkTestIds = [
    ['header-cases-link'],
    ['header-data-verification-link'],
    ['header-search-link'],
  ];
  test.each(linkTestIds)('should activate %s link when clicked', async (linkTestId: string) => {
    renderWithoutProps();

    let linkToClick = await screen.findByTestId(linkTestId);
    fireEvent.click(linkToClick);

    linkToClick = await screen.findByTestId(linkTestId);
    expect(linkToClick).toHaveClass('usa-current current');

    const current = document.querySelectorAll('.usa-current.current');
    expect(current).toHaveLength(1);
  });
});
