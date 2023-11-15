import { render, screen } from '@testing-library/react';
import CaseDetailNavigation, { NavState, setCurrentNav } from './CaseDetailNavigation';
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

  test('should render component', () => {
    render(
      <BrowserRouter>
        <CaseDetailNavigation caseId="12345" />
      </BrowserRouter>,
    );

    const basicLink = screen.getByTestId('basic-info-link');
    const docketLink = screen.getByTestId('court-docket-link');

    expect(basicLink).toBeInTheDocument();
    expect(docketLink).toBeInTheDocument();
  });
});
