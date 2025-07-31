import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe } from 'vitest';
import { render, waitFor, screen, queryByTestId } from '@testing-library/react';
import CaseDetailScreen from './CaseDetailScreen';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { CaseDetail, CaseNote } from '@common/cams/cases';
import { Debtor, DebtorAttorney } from '@common/cams/parties';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import * as detailHeader from './panels/CaseDetailHeader';
import MockData from '@common/cams/test-utilities/mock-data';
import testingUtilities from '@/lib/testing/testing-utilities';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import MockApi2 from '@/lib/testing/mock-api2';

const caseId = '101-23-12345';

const brianWilson = MockAttorneys.Brian;
const brianAssignment = MockData.getAttorneyAssignment({ ...brianWilson });
const carlWilson = MockAttorneys.Carl;
const carlAssignment = MockData.getAttorneyAssignment({ ...carlWilson });

const rickBHartName = 'Rick B Hart';

const trialAttorneyLabel = 'Trial Attorney';

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
  const env = process.env;

  type MaybeString = string | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...env,
      CAMS_USE_FAKE_API: 'true',
    };
    const mockFeatureFlags = {
      [FeatureFlagHook.VIEW_TRUSTEE_ON_CASE]: false,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  function renderWithProps(props?: Partial<CaseDetail>, notes: CaseNote[] = []) {
    const renderProps = { ...defaultTestCaseDetail, ...props };

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={renderProps} caseNotes={notes} />
      </BrowserRouter>,
    );
  }

  test('should render CaseDetailHeader', async () => {
    const headerSpy = vi.spyOn(detailHeader, 'default');

    renderWithProps();

    await waitFor(() => {
      expect(headerSpy).toHaveBeenCalled();
    });
  });
  test('should getCaseDetails if no prop provided for caseDetail', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;

    render(
      <MemoryRouter initialEntries={[basicInfoPath]}>
        <Routes>
          <Route path="case-detail/:caseId/*" element={<CaseDetailScreen caseNotes={[]} />} />
        </Routes>
      </MemoryRouter>,
    );
    const loadingSpinner = screen.queryByTestId('case-detail-loading-spinner');
    expect(loadingSpinner).toBeInTheDocument();

    await waitFor(() => {
      const title = screen.getByTestId('case-detail-heading-title');
      const expectedTitle = ` - Test Case Title`;
      expect(title.innerHTML).toEqual(expectedTitle);
    });

    await waitFor(() => {
      const chapter = screen.getByTestId('case-chapter');
      expect(chapter.innerHTML).toEqual('Voluntary Chapter&nbsp;15');
    });
  });

  test('should show global alert if not able to retrieve caseDetail', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;
    vi.spyOn(MockApi2, 'getCaseDetail').mockRejectedValue('error');
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    render(
      <MemoryRouter initialEntries={[basicInfoPath]}>
        <Routes>
          <Route path="case-detail/:caseId/*" element={<CaseDetailScreen caseNotes={[]} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Could not get case information.');
    });
  });

  test('should not show case associations if error throw in getCaseAssociations', async () => {
    const basicInfoPath = `/case-detail/${defaultTestCaseDetail.caseId}/`;
    vi.spyOn(MockApi2, 'getCaseAssociations').mockRejectedValue('error');

    render(
      <MemoryRouter initialEntries={[basicInfoPath]}>
        <Routes>
          <Route path="case-detail/:caseId/*" element={<CaseDetailScreen caseNotes={[]} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const associatedLink = screen.queryByTestId('associated-cases-link');
      expect(associatedLink).not.toBeInTheDocument();
    });
  });

  test('should display case title, case number, dates, assignees, judge name, and debtor for the case', async () => {
    const mockDateFiled = '01-01-1962';
    const mockClosedDate = '01-01-1963';
    const mockDismissedDate = '01-30-1964';
    const mockReopenedDate = '01-15-1962';

    renderWithProps({
      dateFiled: mockDateFiled,
      closedDate: mockClosedDate,
      dismissedDate: mockDismissedDate,
      reopenedDate: mockReopenedDate,
    });

    await waitFor(
      //TODO: this really needs fixed
      async () => {
        const title = screen.getByTestId('case-detail-heading-title');
        const expectedTitle = ` - ${defaultTestCaseDetail.caseTitle}`;
        expect(title.innerHTML).toEqual(expectedTitle);

        const caseNumber = document.querySelector('.case-number');
        expect(caseNumber?.textContent?.trim()).toEqual(caseId);

        const dateFiled = screen.getByTestId('case-detail-filed-date');
        expect(dateFiled).toHaveTextContent('Filed');
        expect(dateFiled).toHaveTextContent(formatDate(mockDateFiled));

        const closedDate = screen.getByTestId('case-detail-closed-date');
        expect(closedDate).toHaveTextContent('Closed by court');
        expect(closedDate).toHaveTextContent(formatDate(mockClosedDate));

        const dismissedDate = screen.getByTestId('case-detail-dismissed-date');
        expect(dismissedDate).toHaveTextContent('Dismissed by court');
        expect(dismissedDate).toHaveTextContent(formatDate(mockDismissedDate));

        const chapter = screen.getByTestId('case-chapter');
        expect(chapter.innerHTML).toContain(defaultTestCaseDetail.chapter);

        const courtName = screen.getByTestId('court-name-and-district');
        expect(courtName.innerHTML).toEqual(
          `${defaultTestCaseDetail.courtName} (${defaultTestCaseDetail.courtDivisionName})`,
        );

        const region = screen.getByTestId('case-detail-region-id');
        expect(region.innerHTML).toContain(
          `Region ${defaultTestCaseDetail.regionId.replace(/^0*/, '')} - ${defaultTestCaseDetail.courtDivisionName} Office`,
        );

        const assigneeMap = new Map<string, string>();
        const assigneeElements = document.querySelectorAll(
          '.assigned-staff-list .individual-assignee',
        );
        assigneeElements?.forEach((assignee) => {
          const name = assignee.querySelector('.assignee-name')?.innerHTML;
          const role = assignee.querySelector('.assignee-role')?.innerHTML;
          if (name && role) {
            assigneeMap.set(name, role);
          }
        });
        expect(assigneeMap.get(`${brianWilson.name}`)).toEqual(trialAttorneyLabel);
        expect(assigneeMap.get(`${carlWilson.name}`)).toEqual(trialAttorneyLabel);

        const judgeName = screen.getByTestId('case-detail-judge-name');
        expect(judgeName).toHaveTextContent(defaultTestCaseDetail.judgeName as string);

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
          const testId = `case-detail-debtor-${property}`;
          if (defaultTestCaseDetail.debtor[property]) {
            const element = screen.getByTestId(testId);
            expect(element.innerHTML).toEqual(defaultTestCaseDetail.debtor[property]);
          } else {
            const element = screen.queryByTestId(testId);
            expect(element).not.toBeInTheDocument();
          }
        });
      },
      { timeout: 5000 },
    );
  }, 20000);

  const regionTestCases = [
    ['02', 'New York', 'Region 2 - New York Office'],
    ['10', 'Indianapolis', 'Region 10 - Indianapolis Office'],
  ];

  test.each(regionTestCases)(
    'should display the reformatted region ID',
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

      renderWithProps({ ...testCaseDetail });

      await waitFor(
        async () => {
          const region = screen.getByTestId('case-detail-region-id');
          expect(region.innerHTML).toEqual(expectedRegionId);
        },
        { timeout: 5000 },
      );
    },
    20000,
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
      renderWithProps({ ...testCaseDetail });

      await waitFor(
        async () => {
          const properties: Array<keyof Debtor> = [
            'address1',
            'address2',
            'address3',
            'cityStateZipCountry',
          ];
          properties.forEach((property) => {
            const testId = `case-detail-debtor-${property}`;
            if (testCaseDetail.debtor[property]) {
              const element = screen.getByTestId(testId);
              expect(element.innerHTML).toEqual(testCaseDetail.debtor[property]);
            } else {
              const element = screen.queryByTestId(testId);
              expect(element).not.toBeInTheDocument();
            }
          });
        },
        { timeout: 5000 },
      );
    },
    20000,
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
      renderWithProps({ ...testCaseDetail });

      const taxIdIsPresent = !!ssn || !!taxId;
      await waitFor(
        async () => {
          const properties: Array<keyof Debtor> = ['taxId', 'ssn'];
          properties.forEach((property) => {
            const testId = `case-detail-debtor-${property}`;
            if (testCaseDetail.debtor[property]) {
              const element = screen.getByTestId(testId);
              expect(element.innerHTML).toContain(testCaseDetail.debtor[property]);
            } else {
              const element = screen.queryByTestId(testId);
              expect(element).not.toBeInTheDocument();
            }
            const noTaxIdsElement = screen.queryByTestId('case-detail-debtor-no-taxids');
            if (taxIdIsPresent) {
              expect(noTaxIdsElement).not.toBeInTheDocument();
            } else {
              expect(noTaxIdsElement).toHaveTextContent(taxIdUnavailable);
            }
          });
        },
        { timeout: 5000 },
      );
    },
    20000,
  );

  test('should show "No judge assigned" when a judge name is unavailable.', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
      judgeName: '',
    };
    renderWithProps({ ...testCaseDetail });

    await waitFor(
      async () => {
        const judgeName = screen.getByTestId('case-detail-no-judge-name');
        expect(judgeName).toHaveTextContent(informationUnavailable);
      },
      { timeout: 5000 },
    );
  }, 20000);

  test('should show "Information is not available." when a debtor attorney is unavailable.', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney: undefined,
    };

    renderWithProps({ ...testCaseDetail });

    await waitFor(
      async () => {
        const element = screen.getByTestId('case-detail-no-debtor-attorney');
        expect(element).toHaveTextContent(informationUnavailable);
      },
      { timeout: 5000 },
    );
  }, 20000);

  test('should not display case dismissed date if not supplied in api response', async () => {
    const testCaseDetail: CaseDetail = {
      ...defaultTestCaseDetail,
      dismissedDate: undefined,
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };

    renderWithProps({ ...testCaseDetail });

    await waitFor(
      async () => {
        const dismissedDate = screen.queryByTestId('case-detail-dismissed-date');
        expect(dismissedDate).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  }, 20000);

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
    renderWithProps({ ...testCaseDetail });

    await waitFor(
      async () => {
        const closedDateSection = queryByTestId(document.body, 'case-detail-closed-date');
        const reopenedDateSection = queryByTestId(document.body, 'case-detail-reopened-date');

        expect(closedDateSection).not.toBeInTheDocument();

        expect(reopenedDateSection).toBeInTheDocument();
        expect(reopenedDateSection).toHaveTextContent('Reopened by court');
        expect(reopenedDateSection).toHaveTextContent(formatDate(testCaseDetail.reopenedDate!));
      },
      { timeout: 1000 },
    );
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

    renderWithProps({ ...testCaseDetail });

    await waitFor(
      async () => {
        const closedDateSection = queryByTestId(document.body, 'case-detail-closed-date');
        const reopenedDateSection = queryByTestId(document.body, 'case-detail-reopened-date');

        expect(reopenedDateSection).not.toBeInTheDocument();

        expect(closedDateSection).toBeInTheDocument();
        expect(closedDateSection).toHaveTextContent('Closed by court');
        expect(closedDateSection).toHaveTextContent(formatDate(testCaseDetail.closedDate!));
      },
      { timeout: 1000 },
    );
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

    renderWithProps({ ...testCaseDetail });

    const expectedTitle = ` - ${testCaseDetail.caseTitle}`;
    await waitFor(
      async () => {
        const title = screen.getByTestId('case-detail-heading-title');
        expect(title.innerHTML).toEqual(expectedTitle);

        const unassignedElement = document.querySelector('.unassigned-placeholder');
        expect(unassignedElement).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  }, 20000);

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

      const expectedLink = `mailto:${expectedAttorney.email}?subject=${getCaseNumber(
        testCaseDetail.caseId,
      )} - ${testCaseDetail.caseTitle}`;

      renderWithProps({ ...testCaseDetail });

      await waitFor(
        async () => {
          const debtorCounselName = screen.queryByTestId('case-detail-debtor-counsel-name');
          expect(debtorCounselName).toBeInTheDocument();
          if (expectedAttorney?.address1) {
            const address1 = screen.queryByTestId('case-detail-debtor-counsel-address1');
            expect(address1).toBeInTheDocument();
          }
          if (expectedAttorney?.address2) {
            const address2 = screen.queryByTestId('case-detail-debtor-counsel-address2');
            expect(address2).toBeInTheDocument();
          }
          if (expectedAttorney?.address3) {
            const address3 = screen.queryByTestId('case-detail-debtor-counsel-address3');
            expect(address3).toBeInTheDocument();
          }
          if (expectedAttorney?.cityStateZipCountry) {
            const cityStateZipCountry = screen.queryByTestId(
              'case-detail-debtor-counsel-cityStateZipCountry',
            );
            expect(cityStateZipCountry).toBeInTheDocument();
          }
          if (expectedAttorney?.phone) {
            const phone = screen.queryByTestId('case-detail-debtor-counsel-phone');
            expect(phone).toBeInTheDocument();
          }
          if (expectedAttorney?.email) {
            const email = screen.queryByTestId('case-detail-debtor-counsel-email');
            expect(email).toBeInTheDocument();
            const link = email?.children[0].getAttribute('href');
            expect(link).toEqual(expectedLink);
          }
        },
        { timeout: 5000 },
      );
    },
    20000,
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

      // use <MemoryRouter> when you want to manually control the history
      render(
        <MemoryRouter initialEntries={[routePath]}>
          <CaseDetailScreen caseDetail={testCaseDetail} caseNotes={[]} />
        </MemoryRouter>,
      );

      const caseDocketLink = screen.getByTestId(expectedLink);

      expect(caseDocketLink).toHaveClass('usa-current');
    },
  );
});
