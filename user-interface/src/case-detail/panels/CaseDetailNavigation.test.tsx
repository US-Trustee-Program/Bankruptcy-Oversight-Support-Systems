import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaseDetailNavigation, { NavState, mapNavState, setCurrentNav } from './CaseDetailNavigation';
import { BrowserRouter } from 'react-router-dom';

describe('Navigation tests', () => {
  const activeNavClass = 'usa-current current';

  test(`should return ${activeNavClass} when the activeNav equals the stateToCheck`, () => {
    const result = setCurrentNav(NavState.CASE_OVERVIEW, NavState.CASE_OVERVIEW);

    expect(result).toEqual(activeNavClass);
  });

  test('should return an empty string when the activeNav does not equal the stateToCheck', () => {
    const result = setCurrentNav(NavState.CASE_OVERVIEW, NavState.COURT_DOCKET);

    expect(result).toEqual('');
  });

  test.each([
    ['case-overview-link'],
    ['court-docket-link'],
    ['audit-history-link'],
    ['associated-cases-link'],
  ])('should render each navigation element in component', async (linkId: string) => {
    render(
      <BrowserRouter>
        <CaseDetailNavigation
          caseId="12345"
          initiallySelectedNavLink={NavState.CASE_OVERVIEW}
          showAssociatedCasesList={true}
        />
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
  });

  test(`mapNavState should return ${NavState.CASE_OVERVIEW} when the url does not contain a path after the case number`, () => {
    const result = mapNavState('case-detail/1234');

    expect(result).toEqual(NavState.CASE_OVERVIEW);
  });

  test(`mapNavState should return ${NavState.COURT_DOCKET} when the url path contains 'court-docket' after the case number`, () => {
    const result = mapNavState('case-detail/1234/court-docket/');

    expect(result).toEqual(NavState.COURT_DOCKET);
  });

  test(`mapNavState should return ${NavState.AUDIT_HISTORY} when the url path contains 'audit-history' after the case number`, () => {
    const result = mapNavState('case-detail/1234/audit-history');

    expect(result).toEqual(NavState.AUDIT_HISTORY);
  });

  test(`mapNavState should return ${NavState.ASSOCIATED_CASES} when the url path contains 'associated-cases' after the case number`, () => {
    const result = mapNavState('case-detail/1234/associated-cases');

    expect(result).toEqual(NavState.ASSOCIATED_CASES);
  });
});
