import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MyCasesScreen } from './MyCasesScreen';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsUser } from '@common/cams/users';
import { BrowserRouter } from 'react-router-dom';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import Api2 from '@/lib/models/api2';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';

describe('MyCasesScreen', () => {
  const user: CamsUser = MockData.getCamsUser({});

  beforeEach(() => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render an information modal', async () => {
    render(
      <BrowserRouter>
        <MyCasesScreen></MyCasesScreen>
      </BrowserRouter>,
    );

    const toggle = screen.getByTestId('open-modal-button');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle!);

    const modal = screen.getByTestId('modal-content-info-modal');
    expect(modal).toBeInTheDocument();
  });

  test('should toggle closed cases toggle', async () => {
    render(
      <BrowserRouter>
        <MyCasesScreen></MyCasesScreen>
      </BrowserRouter>,
    );

    const toggle = screen.getByTestId('closed-cases-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveClass('inactive');
    fireEvent.click(toggle!);

    expect(toggle).toHaveClass('active');
    fireEvent.click(toggle!);

    expect(toggle).toHaveClass('inactive');
  });

  test('should render a list of cases assigned to a user', async () => {
    const expectedData = MockData.buildArray(MockData.getSyncedCase, 3);
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: expectedData,
    });

    render(
      <BrowserRouter>
        <MyCasesScreen></MyCasesScreen>
      </BrowserRouter>,
    );

    await waitFor(() => {
      const loadingIndicator = screen.queryByTestId('loading-indicator');
      expect(loadingIndicator).not.toBeInTheDocument();
    });

    const tableData = document.querySelectorAll('table tbody td');

    let dIndex = 0;
    for (let i = 0; i < 3; i++) {
      expect(tableData![dIndex++]).toHaveTextContent(
        `${getCaseNumber(expectedData[i].caseId)} (${expectedData[i].courtDivisionName})`,
      );
      expect(tableData![dIndex++]).toHaveTextContent(expectedData[i].caseTitle);
      expect(tableData![dIndex++]).toHaveTextContent(expectedData[i].chapter);
      expect(tableData![dIndex++]).toHaveTextContent(formatDate(expectedData[i].dateFiled));
    }
  });

  test('should render "Invalid user expectation" if user has no offices', () => {
    const user = testingUtilities.setUser({
      offices: undefined,
      roles: [CamsRole.CaseAssignmentManager],
    });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    render(
      <BrowserRouter>
        <MyCasesScreen></MyCasesScreen>
      </BrowserRouter>,
    );
    const body = document.querySelector('body');
    const expectedDiv = '<div />';
    expect(body?.childNodes.length).toEqual(1);
    expect(body?.childNodes[0]).toContainHTML(expectedDiv);
  });
});
