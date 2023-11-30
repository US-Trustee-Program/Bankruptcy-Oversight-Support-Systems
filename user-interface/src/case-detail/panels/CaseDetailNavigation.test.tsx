import { render, screen, waitFor } from '@testing-library/react';
import CaseDetailNavigation, { NavState, mapNavState, setCurrentNav } from './CaseDetailNavigation';
import { BrowserRouter } from 'react-router-dom';
import { CaseDetailNavigationRef } from './CaseDetailNavigation.d';
import React from 'react';

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

  test('should render component', () => {
    render(
      <BrowserRouter>
        <CaseDetailNavigation caseId="12345" initiallySelectedNavLink={NavState.BASIC_INFO} />
      </BrowserRouter>,
    );

    const basicLink = screen.getByTestId('basic-info-link');
    const docketLink = screen.getByTestId('court-docket-link');

    expect(basicLink).toBeInTheDocument();
    expect(docketLink).toBeInTheDocument();
  });

  test(`mapNavState should return ${NavState.BASIC_INFO} when the url does not contain a path after the case number`, () => {
    const result = mapNavState('case-detail/1234');

    expect(result).toEqual(NavState.BASIC_INFO);
  });

  test(`mapNavState should return ${NavState.COURT_DOCKET} when the url path contains 'court-docket' after the case number`, () => {
    const result = mapNavState('case-detail/1234/court-docket/');

    expect(result).toEqual(NavState.COURT_DOCKET);
  });

  test('should render with css class name of "case-details-navigation fixed" when ref.fix() is called and "case-details-navigation" when ref.loosen() is called', async () => {
    const navRef = React.createRef<CaseDetailNavigationRef>();
    render(
      <BrowserRouter>
        <CaseDetailNavigation
          caseId="12345"
          initiallySelectedNavLink={NavState.BASIC_INFO}
          ref={navRef}
        />
      </BrowserRouter>,
    );

    const navigation = document.querySelector('.case-details-navigation');

    navRef.current?.fix();
    await waitFor(async () => {
      expect(navigation).toHaveClass('fixed');
    });

    navRef.current?.loosen();
    await waitFor(async () => {
      expect(navigation).not.toHaveClass('fixed');
    });
  });
});
