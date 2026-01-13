import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import CaseDetailScreen from './CaseDetailScreen';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { CaseDetail, CaseNote } from '@common/cams/cases';
import { Debtor, DebtorAttorney } from '@common/cams/parties';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import * as detailHeader from './panels/CaseDetailHeader';
import MockData from '@common/cams/test-utilities/mock-data';
import TestingUtilities from '@/lib/testing/testing-utilities';
import MockApi2 from '@/lib/testing/mock-api2';

const caseId = '101-23-12345';

const brianWilson = MockAttorneys.Brian;
const brianAssignment = MockData.getAttorneyAssignment({ ...brianWilson });
const carlWilson = MockAttorneys.Carl;
const carlAssignment = MockData.getAttorneyAssignment({ ...carlWilson });

const rickBHartName = 'Rick B Hart';

const informationUnavailable = 'Information is not available.';
const taxIdUnavailable = 'Tax ID information is not available.';
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

  type MaybeString = string | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...env,
      CAMS_USE_FAKE_API: 'true',
    };
  });

  async function renderWithProps(props?: Partial<CaseDetail>, notes: CaseNote[] = []) {
    const renderProps = { ...defaultTestCaseDetail, ...props };

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={renderProps} caseNotes={notes} />
      </BrowserRouter>,
    );

    await TestingUtilities.waitForDocumentBody();
  }

  async function renderWithRoutes(
    caseDetail?: Partial<CaseDetail> | null,
    notes: CaseNote[] = [],
    infoPath?: string,
  ) {
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
                <CaseDetailScreen caseDetail={renderProps as CaseDetail} caseNotes={notes} />
              ) : (
                <CaseDetailScreen caseNotes={notes} />
              )
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await TestingUtilities.waitForDocumentBody();
  }

  test('should render CaseDetailHeader', async () => {
    const headerSpy = vi.spyOn(detailHeader, 'default');

    await renderWithProps();

    await waitFor(() => {
      expect(headerSpy).toHaveBeenCalled();
    });
  });

  test('should getCaseDetails if no prop provided for caseDetail', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;

    await renderWithRoutes(undefined, [], basicInfoPath);

    const title = await screen.findByTestId('case-detail-heading-title');
    expect(title.textContent).toContain('Trevor Shields');

    const chapter = await screen.findByTestId('tag-case-chapter');
    expect(chapter).toHaveTextContent('Voluntary Chapter 15');
  });

  test('should show global alert if not able to retrieve caseDetail', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;
    vi.spyOn(MockApi2, 'getCaseDetail').mockRejectedValue('error');
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    await renderWithRoutes(undefined, [], basicInfoPath);

    await waitFor(() =>
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Could not get case information.'),
    );
  });

  test('should not show case associations if error throw in getCaseAssociations', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;
    vi.spyOn(MockApi2, 'getCaseAssociations').mockRejectedValue('error');

    await renderWithRoutes(undefined, [], basicInfoPath);

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
    expect(closedDate).toHaveTextContent('Closed by court');
    expect(closedDate).toHaveTextContent(formatDate(mockClosedDate));

    const dismissedDate = await screen.findByTestId('case-detail-dismissed-date');
    expect(dismissedDate).toHaveTextContent('Dismissed by court');
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

  const regionTestCases = [
    ['02', 'New York', 'Region 2 - New York Office'],
    ['10', 'Indianapolis', 'Region 10 - Indianapolis Office'],
  ];

  test.each(regionTestCases)(
    'should display the reformatted region ID on trustee and assigned staff panel',
    async (regionId: string, officeName: string, expectedRegionId: string) => {
      const testCaseDetail: CaseDetail = {
        ...defaultTestCaseDetail,
        regionId,
        officeName,
        debtor: {
          name: 'Roger Rabbit',
        },
        debtorAttorney,
      };

      const infoPath = `/case-detail/${testCaseDetail.caseId}/trustee-and-assigned-staff`;
      await renderWithRoutes({ ...testCaseDetail }, [], infoPath);

      await screen.findByTestId('case-detail-heading-title');
      const region = screen.getByTestId('case-detail-region-id');
      expect(region).toHaveTextContent(expectedRegionId);
    },
  );

  const debtorAddressTestCases = [
    [undefined, undefined, undefined, undefined],
    ['123 Rabbithole Lane', 'Unit 321', undefined, 'Ciudad Obregón GR 25443, MX'],
    ['123 Rabbithole Lane', undefined, 'Unit 456', 'Ciudad Obregón GR 25443, MX'],
    ['123 Rabbithole Lane', undefined, undefined, 'Ciudad Obregón GR 25443, MX'],
    ['123 Rabbithole Lane', 'Unit', '111', 'Ciudad Obregón GR 25443, MX'],
    ['123 Rabbithole Lane', 'Ciudad Obregón GR 25443, MX', undefined, undefined],
    ['123 Rabbithole Lane', undefined, undefined, undefined],
  ];

  test.each(debtorAddressTestCases)(
    'should display debtor address with various address lines present/absent',
    async (
      address1: MaybeString,
      address2: MaybeString,
      address3: MaybeString,
      cityStateZipCountry: MaybeString,
    ) => {
      const testCaseDetail: CaseDetail = {
        ...defaultTestCaseDetail,
        debtor: {
          name: 'Roger Rabbit',
          address1,
          address2,
          address3,
          cityStateZipCountry,
        },
        debtorAttorney,
      };
      await renderWithProps({ ...testCaseDetail });

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
        if (testCaseDetail.debtor[property]) {
          const element = screen.getByTestId(testId);
          expect(element).toHaveTextContent(testCaseDetail.debtor[property] as string);
        } else {
          const element = screen.queryByTestId(testId);
          expect(element).not.toBeInTheDocument();
        }
      });
    },
  );

  const debtorTaxIdTestCases = [
    [undefined, undefined],
    ['888-76-5438', undefined],
    [undefined, '34-8765438'],
    ['888-76-5438', '34-8765438'],
  ];

  test.each(debtorTaxIdTestCases)(
    'should display debtor tax ID information with various IDs lines present/absent',
    async (ssn: MaybeString, taxId: MaybeString) => {
      const testCaseDetail: CaseDetail = {
        ...defaultTestCaseDetail,
        debtor: {
          name: 'Roger Rabbit',
          ssn,
          taxId,
        },
        debtorAttorney,
      };
      await renderWithProps({ ...testCaseDetail });

      await screen.findByTestId('case-detail-heading-title');
      const taxIdIsPresent = !!ssn || !!taxId;
      const properties: Array<keyof Debtor> = ['taxId', 'ssn'];
      properties.forEach((property) => {
        const testId = `case-detail-debtor-${property}`;
        if (testCaseDetail.debtor[property]) {
          const element = screen.getByTestId(testId);
          expect(element).toHaveTextContent(testCaseDetail.debtor[property] as string);
        } else {
          const element = screen.queryByTestId(testId);
          expect(element).not.toBeInTheDocument();
        }
      });
      const noTaxIdsElement = screen.queryByTestId('case-detail-debtor-no-taxids');
      if (taxIdIsPresent) {
        expect(noTaxIdsElement).not.toBeInTheDocument();
      } else {
        expect(noTaxIdsElement).toHaveTextContent(taxIdUnavailable);
      }
    },
  );

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
    expect(reopenedDateSection).toHaveTextContent('Reopened by court');
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
    expect(closedDateSection).toHaveTextContent('Closed by court');
    expect(closedDateSection).toHaveTextContent(formatDate(testCaseDetail.closedDate!));
  });

  test('should display (unassigned) when no assignment exist for case', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      assignments: [],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };

    const infoPath = `/case-detail/${testCaseDetail.caseId}/trustee-and-assigned-staff`;
    await renderWithRoutes({ ...testCaseDetail }, [], infoPath);

    const title = screen.getByTestId('case-detail-heading-title');
    expect(title.textContent).toContain(testCaseDetail.debtor.name);

    const unassignedElement = document.querySelector('.unassigned-placeholder');
    expect(unassignedElement).toBeInTheDocument();
  });

  const debtorCounselTestCases = [
    [undefined, undefined, undefined, undefined, undefined, undefined],
    ['123 Rabbithole Lane', undefined, undefined, undefined, undefined, undefined],
    [undefined, 'Unit', undefined, undefined, undefined, undefined],
    [undefined, undefined, '111', undefined, undefined, undefined],
    [undefined, undefined, undefined, 'New York NY 10001 US', undefined, undefined],
    [undefined, undefined, undefined, undefined, '23+12345678', undefined],
    [undefined, undefined, undefined, undefined, undefined, 'attorney@example.com'],
    [
      '123 Rabbithole Lane',
      'Unit',
      '111',
      'New York NY 10001 US',
      '23+12345678',
      'attorney@example.com',
    ],
  ];

  test.each(debtorCounselTestCases)(
    'should show debtor attorney/counsel information',
    async (
      address1: MaybeString,
      address2: MaybeString,
      address3: MaybeString,
      cityStateZipCountry: MaybeString,
      phone: MaybeString,
      email: MaybeString,
    ) => {
      const expectedAttorney: DebtorAttorney = {
        name: rickBHartName,
        address1,
        address2,
        address3,
        cityStateZipCountry,
        phone,
        email,
      };

      const testCaseDetail: CaseDetail = {
        ...defaultTestCaseDetail,
        debtor: {
          name: 'Roger Rabbit',
        },
        debtorAttorney: expectedAttorney,
      };

      const expectedLink = `mailto:${expectedAttorney.email}?subject=${encodeURIComponent(
        `${getCaseNumber(testCaseDetail.caseId)} - ${testCaseDetail.debtor.name}`,
      )}`;

      await renderWithProps({ ...testCaseDetail });

      await screen.findByTestId('case-detail-debtor-counsel-name');
      const debtorCounselName = screen.getByTestId('case-detail-debtor-counsel-name');
      expect(debtorCounselName).toBeInTheDocument();

      if (expectedAttorney?.address1) {
        expect(screen.getByTestId('case-detail-debtor-counsel-address1')).toBeInTheDocument();
      }
      if (expectedAttorney?.address2) {
        expect(screen.getByTestId('case-detail-debtor-counsel-address2')).toBeInTheDocument();
      }
      if (expectedAttorney?.address3) {
        expect(screen.getByTestId('case-detail-debtor-counsel-address3')).toBeInTheDocument();
      }
      if (expectedAttorney?.cityStateZipCountry) {
        expect(screen.getByTestId('case-detail-debtor-counsel-city-state-zip')).toBeInTheDocument();
      }
      if (expectedAttorney?.phone) {
        expect(screen.getByTestId('case-detail-debtor-counsel-phone-number')).toBeInTheDocument();
      }
      if (expectedAttorney?.email) {
        const email = screen.getByTestId('case-detail-debtor-counsel-email');
        expect(email).toBeInTheDocument();
        const link = email?.children[0].getAttribute('href');
        expect(link).toEqual(expectedLink);
      }
    },
  );

  const navRouteTestCases = [
    ['case-detail/1234', 'case-overview-link'],
    ['case-detail/1234/', 'case-overview-link'],
    ['case-detail/1234/court-docket/', 'court-docket-link'],
  ];

  test.each(navRouteTestCases)(
    'should highlight the correct nav link when loading the corresponding url directly in browser',
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

      await renderWithRoutes(testCaseDetail, [], finalRoute);

      const caseDocketLink = screen.getByTestId(expectedLink);

      expect(caseDocketLink).toHaveClass('usa-current');
    },
  );
});
