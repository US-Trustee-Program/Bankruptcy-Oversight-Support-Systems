import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MyCasesScreen } from './MyCasesScreen';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsUser } from '@common/cams/users';
import { BrowserRouter } from 'react-router-dom';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import Api2 from '@/lib/models/api2';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { Cacheable } from '@/lib/utils/local-cache';
import { CaseNoteInput } from '@common/cams/cases';
import useFeatureFlags, {
  PHONETIC_SEARCH_ENABLED,
  SHOW_DEBTOR_NAME_COLUMN,
} from '@/lib/hooks/UseFeatureFlags';

vi.mock('@/lib/hooks/UseFeatureFlags');
const mockUseFeatureFlags = vi.mocked(useFeatureFlags);

describe('MyCasesScreen', () => {
  const user: CamsUser = MockData.getCamsUser({});

  const renderWithoutProps = () => {
    render(
      <BrowserRouter>
        <MyCasesScreen></MyCasesScreen>
      </BrowserRouter>,
    );
  };

  beforeEach(() => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
    mockUseFeatureFlags.mockReturnValue({
      [PHONETIC_SEARCH_ENABLED]: true,
      [SHOW_DEBTOR_NAME_COLUMN]: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render an information modal', async () => {
    renderWithoutProps();

    const toggle = screen.getByTestId('open-modal-button');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle!);

    expect(await screen.findByTestId('modal-content-info-modal')).toBeInTheDocument();
  });

  test('should toggle closed cases toggle', async () => {
    renderWithoutProps();

    const toggle = screen.getByTestId('closed-cases-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveClass('inactive');

    fireEvent.click(toggle!);
    await waitFor(() => expect(toggle).toHaveClass('active'));

    fireEvent.click(toggle!);
    await waitFor(() => expect(toggle).toHaveClass('inactive'));
  });

  test('should render a list of cases assigned to a user', async () => {
    const expectedData = MockData.buildArray(MockData.getSyncedCase, 3);
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: expectedData,
    });

    renderWithoutProps();

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
      expect(tableData![dIndex++]).toHaveTextContent(expectedData[i].debtor?.name ?? '');
      expect(tableData![dIndex++]).toHaveTextContent(expectedData[i].chapter);
      expect(tableData![dIndex++]).toHaveTextContent(formatDate(expectedData[i].dateFiled));
    }
  });

  test('should render "Invalid user expectation" if user has no offices', async () => {
    const user = TestingUtilities.setUser({
      offices: undefined,
      roles: [CamsRole.CaseAssignmentManager],
    });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    renderWithoutProps();
    await TestingUtilities.waitForDocumentBody();

    const body = document.querySelector('body');

    const expectedDiv = '<div />';
    expect(body?.childNodes.length).toEqual(1);
    expect(body?.childNodes[0]).toContainHTML(expectedDiv);
  });

  test('should render a list of cases without debtor name column when phonetic search is disabled', async () => {
    mockUseFeatureFlags.mockReturnValue({
      [PHONETIC_SEARCH_ENABLED]: false,
      [SHOW_DEBTOR_NAME_COLUMN]: false,
    });

    const expectedData = MockData.buildArray(MockData.getSyncedCase, 3);
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: expectedData,
    });

    renderWithoutProps();

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

  const now = new Date().toISOString();
  const cachedNotesCases = [
    {
      caseName: '1 case note',
      expectedAlertText: 'You have a draft case note on case 00-12345. It will expire on',
      cachedValues: [
        {
          key: 'foo1',
          item: {
            expiresAfter: new Date(MockData.someDateAfterThisDate(now, 10)).valueOf(),
            value: { title: 'title', content: 'content', caseId: '081-00-12345' },
          },
        },
      ],
    },
    {
      caseName: '2 case notes',
      expectedAlertText:
        'You have draft case notes on cases 00-12345 and 00-54321. The draft on case number',
      cachedValues: [
        {
          key: 'foo1',
          item: {
            expiresAfter: new Date(MockData.someDateAfterThisDate(now, 10)).valueOf(),
            value: { title: 'title', content: 'content', caseId: '081-00-12345' },
          },
        },
        {
          key: 'foo2',
          item: {
            expiresAfter: new Date(MockData.someDateAfterThisDate(now, 10)).valueOf(),
            value: { title: 'title', content: 'content', caseId: '081-00-54321' },
          },
        },
      ],
    },
    {
      caseName: '3 case notes',
      expectedAlertText:
        'You have draft case notes on cases 00-12345, 00-54321, and 00-54322. The draft on case number',
      cachedValues: [
        {
          key: 'foo1',
          item: {
            expiresAfter: new Date(MockData.someDateAfterThisDate(now, 10)).valueOf(),
            value: { title: 'title', content: 'content', caseId: '081-00-12345' },
          },
        },
        {
          key: 'foo2',
          item: {
            expiresAfter: new Date(MockData.someDateAfterThisDate(now, 10)).valueOf(),
            value: { title: 'title', content: 'content', caseId: '081-00-54321' },
          },
        },
        {
          key: 'foo3',
          item: {
            expiresAfter: new Date(MockData.someDateAfterThisDate(now, 10)).valueOf(),
            value: { title: 'title', content: 'content', caseId: '081-00-54322' },
          },
        },
      ],
    },
  ];
  test.each(cachedNotesCases)(
    'should display alert if cache holds $caseName',
    async (args: {
      caseName: string;
      expectedAlertText: string;
      cachedValues: Array<{ key: string; item: Cacheable<CaseNoteInput> }>;
    }) => {
      vi.spyOn(LocalFormCache, 'getFormsByPattern').mockImplementation((_pattern: RegExp) => {
        return args.cachedValues;
      });

      renderWithoutProps();
      await TestingUtilities.waitForDocumentBody();

      const alertMessage = document.querySelector('.draft-notes-alert-message');
      expect(alertMessage).toBeInTheDocument();
      expect(alertMessage).toHaveTextContent(args.expectedAlertText);
    },
  );

  test('should deduplicate case IDs when displaying draft notes alert', async () => {
    const duplicatedId = '081-00-12345';
    const uniqueId = '081-00-54321';
    const earlierDate = new Date(MockData.someDateAfterThisDate(now, 10));
    const laterDate = new Date(MockData.someDateAfterThisDate(earlierDate.toISOString(), 5));
    const duplicateCaseIdValues = [
      {
        key: 'foo1',
        item: {
          expiresAfter: earlierDate.valueOf(),
          value: { title: 'title 1', content: 'content 1', caseId: duplicatedId },
        },
      },
      {
        key: 'foo2',
        item: {
          expiresAfter: laterDate.valueOf(),
          value: { title: 'title 2', content: 'content 2', caseId: duplicatedId },
        },
      },
      {
        key: 'foo3',
        item: {
          expiresAfter: new Date(MockData.someDateAfterThisDate(now, 15)).valueOf(),
          value: { title: 'title 3', content: 'content 3', caseId: uniqueId },
        },
      },
    ];

    vi.spyOn(LocalFormCache, 'getFormsByPattern').mockImplementation((_pattern: RegExp) => {
      return duplicateCaseIdValues;
    });

    renderWithoutProps();
    await TestingUtilities.waitForDocumentBody();

    const alertMessage = document.querySelector('.draft-notes-alert-message');
    expect(alertMessage).toBeInTheDocument();
    expect(alertMessage).toHaveTextContent(
      `You have draft case notes on cases ${getCaseNumber(duplicatedId)} and ${getCaseNumber(uniqueId)}`,
    );
    expect(alertMessage).toHaveTextContent(
      `The draft on case number ${getCaseNumber(duplicatedId)} expires on ${formatDateTime(new Date(earlierDate))}.`,
    );
  });
});
