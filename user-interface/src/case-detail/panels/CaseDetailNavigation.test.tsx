import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaseDetailNavigation, { CaseNavState, mapNavState } from './CaseDetailNavigation';
import { setCurrentNav } from '@/lib/utils/navigation';
import { BrowserRouter } from 'react-router-dom';

describe('Navigation tests', () => {
  const activeNavClass = 'usa-current current';

  test(`should return ${activeNavClass} when the activeNav equals the stateToCheck`, () => {
    const result = setCurrentNav(CaseNavState.CASE_OVERVIEW, CaseNavState.CASE_OVERVIEW);

    expect(result).toEqual(activeNavClass);
  });

  test('should return an empty string when the activeNav does not equal the stateToCheck', () => {
    const result = setCurrentNav(CaseNavState.CASE_OVERVIEW, CaseNavState.COURT_DOCKET);

    expect(result).toEqual('');
  });

  test.each([
    ['case-overview-link'],
    ['case-trustee-and-assigned-staff-link'],
    ['case-trustee-info-link'],
    ['court-docket-link'],
    ['audit-history-link'],
    ['associated-cases-link'],
    ['case-notes-link'],
  ])('should render and activate the %s navigation element', async (linkId: string) => {
    render(
      <BrowserRouter>
        <CaseDetailNavigation
          caseId="12345"
          initiallySelectedNavLink={CaseNavState.CASE_OVERVIEW}
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

  test.each([
    ['/', CaseNavState.CASE_OVERVIEW],
    ['/court-docket', CaseNavState.COURT_DOCKET],
    ['/audit-history', CaseNavState.AUDIT_HISTORY],
    ['/associated-cases', CaseNavState.ASSOCIATED_CASES],
    ['/trustee', CaseNavState.TRUSTEE_INFO],
    ['/trustee-and-assigned-staff', CaseNavState.TRUSTEE_AND_ASSIGNED_STAFF],
    ['/notes', CaseNavState.CASE_NOTES],
  ])(`mapNavState should return correct state for url suffix '%s'`, (suffix, expectedState) => {
    const url = `/case-detail/021-23-07890${suffix}`;
    const result = mapNavState(url);
    expect(result).toEqual(expectedState);
  });

  test('should label the combined tab "Assigned Staff" and always show the Trustee nav link', () => {
    render(
      <BrowserRouter>
        <CaseDetailNavigation
          caseId="12345"
          initiallySelectedNavLink={CaseNavState.CASE_OVERVIEW}
          showAssociatedCasesList={false}
        />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('case-trustee-and-assigned-staff-link')).toHaveTextContent(
      'Assigned Staff',
    );
    expect(screen.getByTestId('case-trustee-and-assigned-staff-link')).not.toHaveTextContent(
      'Assigned Staff & Trustee',
    );
    expect(screen.getByTestId('case-trustee-info-link')).toBeInTheDocument();
  });

  test('should not show the associated cases link when showAssociatedCasesList is false', () => {
    render(
      <BrowserRouter>
        <CaseDetailNavigation
          caseId="12345"
          initiallySelectedNavLink={CaseNavState.CASE_OVERVIEW}
          showAssociatedCasesList={false}
        />
      </BrowserRouter>,
    );

    expect(screen.queryByTestId('associated-cases-link')).not.toBeInTheDocument();
  });
});
