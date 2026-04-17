import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaseDetailNavigation, { CaseNavState, mapNavState } from './CaseDetailNavigation';
import { setCurrentNav } from '@/lib/utils/navigation';
import { BrowserRouter } from 'react-router-dom';
import useFeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { testFeatureFlags } from '@common/feature-flags';

vi.mock('@/lib/hooks/UseFeatureFlags');
const mockUseFeatureFlags = vi.mocked(useFeatureFlags);

describe('Navigation tests', () => {
  const activeNavClass = 'usa-current current';

  beforeEach(() => {
    mockUseFeatureFlags.mockReturnValue(testFeatureFlags);
  });

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
    ['case-trustee-info-link'],
    ['court-docket-link'],
    ['audit-history-link'],
    ['associated-cases-link'],
    ['case-notes-link'],
  ])('should render each navigation element in component', async (linkId: string) => {
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

  test(`mapNavState should return ${CaseNavState.CASE_OVERVIEW} when the url does not contain a path after the case number`, () => {
    const url = '/case-detail/021-23-07890/';
    const result = mapNavState(url);
    expect(result).toEqual(CaseNavState.CASE_OVERVIEW);
  });

  test(`mapNavState should return ${CaseNavState.COURT_DOCKET} when the url path contains 'court-docket' after the case number`, () => {
    const url = '/case-detail/021-23-07890/court-docket';
    const result = mapNavState(url);
    expect(result).toEqual(CaseNavState.COURT_DOCKET);
  });

  test(`mapNavState should return ${CaseNavState.AUDIT_HISTORY} when the url path contains 'audit-history' after the case number`, () => {
    const url = '/case-detail/021-23-07890/audit-history';
    const result = mapNavState(url);
    expect(result).toEqual(CaseNavState.AUDIT_HISTORY);
  });

  test(`mapNavState should return ${CaseNavState.ASSOCIATED_CASES} when the url path contains 'associated-cases' after the case number`, () => {
    const url = '/case-detail/021-23-07890/associated-cases';
    const result = mapNavState(url);
    expect(result).toEqual(CaseNavState.ASSOCIATED_CASES);
  });

  test(`mapNavState should return ${CaseNavState.TRUSTEE_INFO} when the url path contains 'trustee' after the case number`, () => {
    const url = '/case-detail/021-23-07890/trustee';
    const result = mapNavState(url);
    expect(result).toEqual(CaseNavState.TRUSTEE_INFO);
  });

  describe('display-trustee-info-case flag is enabled', () => {
    test('should show separate Trustee nav link', () => {
      render(
        <BrowserRouter>
          <CaseDetailNavigation
            caseId="12345"
            initiallySelectedNavLink={CaseNavState.CASE_OVERVIEW}
            showAssociatedCasesList={false}
          />
        </BrowserRouter>,
      );
      expect(screen.getByTestId('case-trustee-info-link')).toBeInTheDocument();
    });

    test('should label the combined tab "Assigned Staff"', () => {
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
    });
  });

  describe('display-trustee-info-case flag is disabled', () => {
    beforeEach(() => {
      mockUseFeatureFlags.mockReturnValue({
        ...testFeatureFlags,
        'view-trustee-on-case': false,
      });
    });

    test('should not show Trustee nav link', () => {
      render(
        <BrowserRouter>
          <CaseDetailNavigation
            caseId="12345"
            initiallySelectedNavLink={CaseNavState.CASE_OVERVIEW}
            showAssociatedCasesList={false}
          />
        </BrowserRouter>,
      );
      expect(screen.queryByTestId('case-trustee-info-link')).not.toBeInTheDocument();
    });

    test('should label the combined tab "Assigned Staff & Trustee"', () => {
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
        'Assigned Staff & Trustee',
      );
    });
  });
});
