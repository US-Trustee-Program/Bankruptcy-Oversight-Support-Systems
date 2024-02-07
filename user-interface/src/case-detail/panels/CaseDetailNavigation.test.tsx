import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaseDetailNavigation, { NavState, mapNavState, setCurrentNav } from './CaseDetailNavigation';
import { BrowserRouter } from 'react-router-dom';

describe('Navigation tests', () => {
  const activeNavClass = 'usa-current';

  test(`should return ${activeNavClass} when the activeNav equals the stateToCheck`, () => {
    const result = setCurrentNav(NavState.BASIC_INFO, NavState.BASIC_INFO);

    expect(result).toEqual(activeNavClass);
  });

  test('should return an empty string when the activeNav does not equal the stateToCheck', () => {
    const result = setCurrentNav(NavState.BASIC_INFO, NavState.COURT_DOCKET);

    expect(result).toEqual('');
  });

  test.each([['basic-info-link'], ['court-docket-link'], ['audit-history-link']])(
    'should render each navigation element in component',
    async (linkId: string) => {
      render(
        <BrowserRouter>
          <CaseDetailNavigation caseId="12345" initiallySelectedNavLink={NavState.BASIC_INFO} />
        </BrowserRouter>,
      );

      const allLinks = Array.from(document.querySelectorAll('.usa-sidenav__item a'));

      const link = screen.getByTestId(linkId);
      expect(link).toBeInTheDocument();
      fireEvent.click(link as Element);
      await waitFor(() => {
        expect(link).toHaveClass('usa-current');
        const activeLinks = allLinks.filter((l) => l.classList.contains('usa-current'));
        expect(activeLinks.length).toEqual(1);
      });
    },
  );

  test(`mapNavState should return ${NavState.BASIC_INFO} when the url does not contain a path after the case number`, () => {
    const result = mapNavState('case-detail/1234');

    expect(result).toEqual(NavState.BASIC_INFO);
  });

  test(`mapNavState should return ${NavState.COURT_DOCKET} when the url path contains 'court-docket' after the case number`, () => {
    const result = mapNavState('case-detail/1234/court-docket/');

    expect(result).toEqual(NavState.COURT_DOCKET);
  });

  test(`mapNavState should return ${NavState.AUDIT_HISTORY} when the url path contains 'audit-history' after the case number`, () => {
    const result = mapNavState('case-detail/1234/audit-history');

    expect(result).toEqual(NavState.AUDIT_HISTORY);
  });
});
