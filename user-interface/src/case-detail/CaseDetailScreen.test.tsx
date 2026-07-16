import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import CaseDetailScreen from './CaseDetailScreen';
import { getCaseNumber } from '@common/cams/cases';
import { formatDate } from '@/lib/utils/datetime';
import { CaseDetail } from '@common/cams/cases';
import { Debtor, DebtorAttorney } from '@common/cams/parties';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import * as detailHeader from './panels/CaseDetailHeader';
import MockData from '@common/cams/test-utilities/mock-data';
import TestingUtilities from '@/lib/testing/testing-utilities';
import Api2 from '@/lib/models/api2';

const caseId = '101-23-12345';

const brianWilson = MockAttorneys.Brian;
const brianAssignment = MockData.getAttorneyAssignment({ ...brianWilson });
const carlWilson = MockAttorneys.Carl;
const carlAssignment = MockData.getAttorneyAssignment({ ...carlWilson });

const rickBHartName = 'Rick B Hart';

const informationUnavailable = 'Information is not available.';
const debtorAttorney: DebtorAttorney = {
  name: 'Jane Doe',
  address1: '123 Rabbithole Lane',
  cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
  phone: '234-123-1234',
};

const defaultTestCaseDetail = MockData.getCaseDetail({
  override: {
    caseId,
    judgeName: rickBHartName,
    assignments: [brianAssignment, carlAssignment],
  },
});

describe('Case Detail screen tests', () => {
  const { env } = process;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...env,
      CAMS_USE_FAKE_API: 'true',
    };
  });

  async function renderWithProps(props?: Partial<CaseDetail>) {
    const renderProps = { ...defaultTestCaseDetail, ...props };

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={renderProps} />
      </BrowserRouter>,
    );

    await TestingUtilities.waitForDocumentBody();
  }

  async function renderWithRoutes(caseDetail?: Partial<CaseDetail> | null, infoPath?: string) {
    const passCaseDetail = !!caseDetail;
    const renderProps = { ...defaultTestCaseDetail, ...(caseDetail ?? {}) };
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;
    render(
      <MemoryRouter initialEntries={[infoPath ?? basicInfoPath]}>
        <Routes>
          <Route
            path="case-detail/:caseId/*"
            element={
              passCaseDetail ? (
                <CaseDetailScreen caseDetail={renderProps as CaseDetail} />
              ) : (
                <CaseDetailScreen />
              )
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await TestingUtilities.waitForDocumentBody();
  }

  test('should set browser tab title to the case number', async () => {
    await renderWithRoutes(defaultTestCaseDetail);
    await waitFor(() => {
      expect(document.title).toContain(`Case ${getCaseNumber(caseId)}`);
    });
  });

  test('should render CaseDetailHeader', async () => {
    const headerSpy = vi.spyOn(detailHeader, 'default');

    await renderWithProps();

    await waitFor(() => {
      expect(headerSpy).toHaveBeenCalled();
    });
  });

  test('should getCaseDetails if no prop provided for caseDetail', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;
    vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: defaultTestCaseDetail });

    await renderWithRoutes(undefined, basicInfoPath);

    const title = await screen.findByTestId('case-detail-heading-title');
    expect(title.textContent).toContain(defaultTestCaseDetail.debtor.name);

    const chapter = await screen.findByTestId('tag-case-chapter');
    expect(chapter).toHaveTextContent(defaultTestCaseDetail.chapter);
  });

  test('should show global alert if not able to retrieve caseDetail', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;
    vi.spyOn(Api2, 'getCaseDetail').mockRejectedValue('error');
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    await renderWithRoutes(undefined, basicInfoPath);

    await waitFor(() =>
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Could not get case information.'),
    );
  });

  test('should not show case associations if error throw in getCaseAssociations', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;
    vi.spyOn(Api2, 'getCaseAssociations').mockRejectedValue('error');

    await renderWithRoutes(undefined, basicInfoPath);

    await waitFor(() =>
      expect(screen.queryByTestId('associated-cases-link')).not.toBeInTheDocument(),
    );
  });

  test('should display case title, case number, dates, and debtor for the case', async () => {
    const mockDateFiled = '01-01-1962';
    const mockClosedDate = '01-01-1963';
    const mockDismissedDate = '01-30-1964';
    const mockReopenedDate = '01-15-1962';

    await renderWithProps({
      dateFiled: mockDateFiled,
      closedDate: mockClosedDate,
      dismissedDate: mockDismissedDate,
      reopenedDate: mockReopenedDate,
    });

    await screen.findByTestId('case-detail');

    const title = screen.getByTestId('case-detail-heading-title');
    expect(title.textContent).toContain(defaultTestCaseDetail.debtor.name);

    const caseHeading = screen.getByTestId('case-detail-heading');
    expect(caseHeading.textContent).toContain(caseId);

    const dateFiled = await screen.findByTestId('case-detail-filed-date');
    expect(dateFiled).toHaveTextContent('Filed');
    expect(dateFiled).toHaveTextContent(formatDate(mockDateFiled));

    const closedDate = await screen.findByTestId('case-detail-closed-date');
    expect(closedDate).toHaveTextContent(formatDate(mockClosedDate));

    const dismissedDate = await screen.findByTestId('case-detail-dismissed-date');
    expect(dismissedDate).toHaveTextContent(formatDate(mockDismissedDate));

    const chapter = screen.getByTestId('tag-case-chapter');
    expect(chapter).toHaveTextContent(defaultTestCaseDetail.chapter);

    const courtName = screen.getByTestId('tag-court-name-and-district');
    expect(courtName).toHaveTextContent(
      `${defaultTestCaseDetail.courtName} (${defaultTestCaseDetail.courtDivisionName})`,
    );

    const debtorName = screen.getByTestId('case-detail-debtor-name');
    expect(debtorName).toHaveTextContent(defaultTestCaseDetail.debtor.name);

    const debtorType = screen.getByTestId('case-detail-debtor-type');
    expect(debtorType).toHaveTextContent(defaultTestCaseDetail.debtorTypeLabel as string);

    const properties: Array<keyof Debtor> = [
      'address1',
      'address2',
      'address3',
      'cityStateZipCountry',
    ];

    properties.forEach((property) => {
      let testId = `case-detail-debtor-${property}`;
      if (property === 'cityStateZipCountry') {
        testId = 'case-detail-debtor-city-state-zip';
      }
      if (defaultTestCaseDetail.debtor[property]) {
        const element = screen.getByTestId(testId);
        expect(element).toHaveTextContent(defaultTestCaseDetail.debtor[property] as string);
      } else {
        const element = screen.queryByTestId(testId);
        expect(element).not.toBeInTheDocument();
      }
    });
  });

  test('should not show judge tag when a judge name is unavailable', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
      judgeName: '',
    };
    await renderWithProps({ ...testCaseDetail });

    const judgeTag = screen.queryByTestId('tag-case-judge');
    expect(judgeTag).not.toBeInTheDocument();
  });

  test('should show "Information is not available." when a debtor attorney is unavailable.', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney: undefined,
    };

    await renderWithProps({ ...testCaseDetail });

    const element = await screen.findByTestId('case-detail-debtor-no-attorney');
    expect(element).toHaveTextContent(informationUnavailable);
  });

  test('should not display case dismissed date if not supplied in api response', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      dismissedDate: undefined,
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };

    await renderWithProps({ ...testCaseDetail });

    const dismissedDate = screen.queryByTestId('case-detail-dismissed-date');
    expect(dismissedDate).not.toBeInTheDocument();
  });

  test('should not display closed by court date if reopened date is supplied and is later than CBC date', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      reopenedDate: '01-01-2025',
      closedDate: '12-15-2024',
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };
    await renderWithProps({ ...testCaseDetail });

    const reopenedDateSection = await screen.findByTestId('case-detail-reopened-date');
    const closedDateSection = screen.queryByTestId('case-detail-closed-date');

    expect(closedDateSection).not.toBeInTheDocument();

    expect(reopenedDateSection).toBeInTheDocument();
    expect(reopenedDateSection).toHaveTextContent(formatDate(testCaseDetail.reopenedDate!));
  });

  test('should not display reopened date if closed by court date is later than reopened date', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      reopenedDate: '04-15-1969',
      closedDate: '08-08-1970',
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };

    await renderWithProps({ ...testCaseDetail });

    const closedDateSection = await screen.findByTestId('case-detail-closed-date');
    const reopenedDateSection = screen.queryByTestId('case-detail-reopened-date');

    expect(reopenedDateSection).not.toBeInTheDocument();

    expect(closedDateSection).toBeInTheDocument();
    expect(closedDateSection).toHaveTextContent(formatDate(testCaseDetail.closedDate!));
  });

  const navRouteTestCases = [
    ['case-detail/1234', 'case-overview-link'],
    ['case-detail/1234/', 'case-overview-link'],
    ['case-detail/1234/court-docket/', 'court-docket-link'],
  ];

  test.each(navRouteTestCases)(
    'should highlight the correct nav link when loading %s directly in browser',
    async (routePath: string, expectedLink: string) => {
      const testCaseDetail: CaseDetail = {
        ...defaultTestCaseDetail,
        caseId: '080-01-12345',
        assignments: [],
        debtor: {
          name: 'Roger Rabbit',
        },
        debtorAttorney: {
          name: 'Jane Doe',
          address1: '123 Rabbithole Lane',
          cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
          phone: '234-123-1234',
        },
      };

      let finalRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
      finalRoute = finalRoute.replace('1234', testCaseDetail.caseId);

      await renderWithRoutes(testCaseDetail, finalRoute);

      const caseDocketLink = screen.getByTestId(expectedLink);

      expect(caseDocketLink).toHaveClass('usa-current');
    },
  );

  describe('MOVED case handling tests', () => {
    test('should render MOVED alert with all expected content when case is MOVED', async () => {
      const movedCaseDetail: CaseDetail = {
        ...defaultTestCaseDetail,
        movedToCaseId: '101-23-54321',
        debtor: { name: 'Roger Rabbit' },
        debtorAttorney,
      };

      await renderWithProps({ ...movedCaseDetail });

      const alert = screen.getByTestId('case-moved-alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('usa-alert--warning');

      const heading = screen.getByRole('heading', { name: 'Case Division Changed' });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveClass('usa-alert__heading');

      expect(screen.getByText(/This case was moved to a different division/)).toBeInTheDocument();

      const link = screen.getByRole('link', { name: /View the current case/ });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/case-detail/101-23-54321');

      const title = screen.getByTestId('case-detail-heading-title');
      expect(title.textContent).toContain('Roger Rabbit');
    });

    test('should not render MOVED alert when movedToCaseId is absent', async () => {
      const activeCaseDetail: CaseDetail = {
        ...defaultTestCaseDetail,
        debtor: { name: 'Roger Rabbit' },
        debtorAttorney,
      };

      await renderWithProps({ ...activeCaseDetail });

      const alert = screen.queryByTestId('case-moved-alert');
      expect(alert).not.toBeInTheDocument();
    });
  });

  test('should render Trustee panel when navigating to /trustee', async () => {
    const trusteePath = `/case-detail/${defaultTestCaseDetail.caseId}/trustee`;
    await renderWithRoutes(defaultTestCaseDetail, trusteePath);

    const trusteePanel = await screen.findByTestId('case-detail-trustee-panel');
    expect(trusteePanel).toBeInTheDocument();
  });
});
