import { describe } from 'vitest';
import { render, waitFor, screen, queryByTestId, fireEvent, act } from '@testing-library/react';
import { CaseDetail, docketSorterClosure, applySortAndFilters } from './CaseDetailScreen';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import {
  CaseDetailType,
  CaseDocket,
  CaseDocketEntry,
  Debtor,
  DebtorAttorney,
} from '@/lib/type-declarations/chapter-15';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import ReactRouter from 'react-router';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { vi } from 'vitest';

const caseId = '101-23-12345';
const brianWilsonName = 'Brian Wilson';
const carlWilsonName = 'Carl Wilson';
const trialAttorneyRole = 'Trial Attorney';

const rickBHartName = 'Rick B Hart';

const informationUnavailable = 'Information is not available.';
const taxIdUnavailable = 'Tax ID information is not available.';
const debtorAttorney: DebtorAttorney = {
  name: 'Jane Doe',
  address1: '123 Rabbithole Lane',
  cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
  phone: '234-123-1234',
};

describe('Case Detail screen tests', () => {
  const env = process.env;

  type MaybeString = string | undefined;

  beforeAll(() => {
    process.env = {
      ...env,
      CAMS_PA11Y: 'true',
    };
  });

  test('should display case title, case number, dates, assignees, judge name, and debtor for the case', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      regionId: '02',
      officeName: 'New York',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      courtName: 'Court of Law',
      courtDivisionName: 'Manhattan',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [brianWilsonName, carlWilsonName],
      debtor: {
        name: 'Roger Rabbit',
        address1: '123 Rabbithole Lane',
        address2: 'Apt 117',
        address3: 'Suite C',
        cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
      },
      debtorAttorney,
    };
    render(
      <BrowserRouter>
        <CaseDetail caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const title = screen.getByTestId('case-detail-heading');
        expect(title.innerHTML).toEqual('The Beach Boys');

        const caseNumber = document.querySelector('.case-number');
        expect(caseNumber?.innerHTML).toEqual(getCaseNumber(caseId));

        const dateFiled = screen.getByTestId('case-detail-filed-date');
        expect(dateFiled).toHaveTextContent('Filed');
        expect(dateFiled).toHaveTextContent('01-04-1962');

        const closedDate = screen.getByTestId('case-detail-closed-date');
        expect(closedDate).toHaveTextContent('Closed by court');
        expect(closedDate).toHaveTextContent('01-08-1963');

        const dismissedDate = screen.getByTestId('case-detail-dismissed-date');
        expect(dismissedDate).toHaveTextContent('Dismissed by court');
        expect(dismissedDate).toHaveTextContent('01-08-1964');

        const chapter = screen.getByTestId('case-chapter');
        expect(chapter.innerHTML).toEqual('Voluntary Chapter&nbsp;15');

        const courtName = screen.getByTestId('court-name-and-district');
        expect(courtName.innerHTML).toEqual('Court of Law - Manhattan');

        const region = screen.getByTestId('case-detail-region-id');
        expect(region.innerHTML).toEqual('Region 2 - New York Office');

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
        expect(assigneeMap.get(`${brianWilsonName}`)).toEqual(trialAttorneyRole);
        expect(assigneeMap.get(`${carlWilsonName}`)).toEqual(trialAttorneyRole);

        const judgeName = screen.getByTestId('case-detail-judge-name');
        expect(judgeName).toHaveTextContent(rickBHartName);

        const debtorName = screen.getByTestId('case-detail-debtor-name');
        expect(debtorName).toHaveTextContent(testCaseDetail.debtor.name);

        const debtorType = screen.getByTestId('case-detail-debtor-type');
        expect(debtorType).toHaveTextContent(testCaseDetail.debtorTypeLabel);

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
  }, 20000);

  const regionTestCases = [
    ['02', 'New York', 'Region 2 - New York Office'],
    ['10', 'Indianapolis', 'Region 10 - Indianapolis Office'],
  ];

  test.each(regionTestCases)(
    'should display the reformatted region ID',
    async (regionId: string, officeName: string, expectedRegionId: string) => {
      const testCaseDetail: CaseDetailType = {
        caseId: caseId,
        chapter: '15',
        regionId,
        officeName,
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: rickBHartName,
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary Petition',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianWilsonName, carlWilsonName],
        debtor: {
          name: 'Roger Rabbit',
        },
        debtorAttorney,
      };
      render(
        <BrowserRouter>
          <CaseDetail caseDetail={testCaseDetail} />
        </BrowserRouter>,
      );

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
      const testCaseDetail: CaseDetailType = {
        caseId: caseId,
        chapter: '15',
        officeName: 'Redondo Beach',
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: rickBHartName,
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary Petition',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianWilsonName, carlWilsonName],
        debtor: {
          name: 'Roger Rabbit',
          address1,
          address2,
          address3,
          cityStateZipCountry,
        },
        debtorAttorney,
      };
      render(
        <BrowserRouter>
          <CaseDetail caseDetail={testCaseDetail} />
        </BrowserRouter>,
      );

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
      const testCaseDetail: CaseDetailType = {
        caseId: caseId,
        chapter: '15',
        officeName: 'Redondo Beach',
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: rickBHartName,
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary Petition',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianWilsonName, carlWilsonName],
        debtor: {
          name: 'Roger Rabbit',
          ssn,
          taxId,
        },
        debtorAttorney,
      };
      render(
        <BrowserRouter>
          <CaseDetail caseDetail={testCaseDetail} />
        </BrowserRouter>,
      );

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
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      closedDate: '01-08-1963',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary Petition',
      dismissedDate: '01-08-1964',
      assignments: [brianWilsonName, carlWilsonName],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };
    render(
      <BrowserRouter>
        <CaseDetail caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const judgeName = screen.getByTestId('case-detail-no-judge-name');
        expect(judgeName).toHaveTextContent(informationUnavailable);
      },
      { timeout: 5000 },
    );
  }, 20000);
  test('should show "Information is not available." when a debtor attorney is unavailable.', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [brianWilsonName, carlWilsonName],
      judgeName: 'Honorable Jason Smith',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary Petition',
      debtor: {
        name: 'Roger Rabbit',
      },
    };
    render(
      <BrowserRouter>
        <CaseDetail caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const element = screen.getByTestId('case-detail-no-debtor-attorney');
        expect(element).toHaveTextContent(informationUnavailable);
      },
      { timeout: 5000 },
    );
  }, 20000);

  test('should not display case dismissed date if not supplied in api response', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary Petition',
      closedDate: '01-08-1963',
      assignments: [brianWilsonName, carlWilsonName],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };
    render(
      <BrowserRouter>
        <CaseDetail caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const dismissedDate = queryByTestId(document.body, 'case-detail-dismissed-date');
        expect(dismissedDate).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  }, 20000);

  test('should not display closed by court date if reopened date is supplied and is later than CBC date', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary Petition',
      closedDate: '01-08-1963',
      reopenedDate: '04-15-1969',
      assignments: [brianWilsonName, carlWilsonName],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };
    render(
      <BrowserRouter>
        <CaseDetail caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const closedDateSection = queryByTestId(document.body, 'case-detail-closed-date');
        const reopenedDateSection = queryByTestId(document.body, 'case-detail-reopened-date');

        expect(closedDateSection).not.toBeInTheDocument();

        expect(reopenedDateSection).toBeInTheDocument();
        expect(reopenedDateSection).toHaveTextContent('Reopened by court');
        expect(reopenedDateSection).toHaveTextContent(testCaseDetail.reopenedDate as string);
      },
      { timeout: 1000 },
    );
  });

  test('should not display reopened date if closed by court date is later than reopened date', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary Petition',
      reopenedDate: '04-15-1969',
      closedDate: '08-08-1970',
      assignments: [brianWilsonName, carlWilsonName],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };
    render(
      <BrowserRouter>
        <CaseDetail caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const closedDateSection = queryByTestId(document.body, 'case-detail-closed-date');
        const reopenedDateSection = queryByTestId(document.body, 'case-detail-reopened-date');

        expect(reopenedDateSection).not.toBeInTheDocument();

        expect(closedDateSection).toBeInTheDocument();
        expect(closedDateSection).toHaveTextContent('Closed by court');
        expect(closedDateSection).toHaveTextContent(testCaseDetail.closedDate as string);
      },
      { timeout: 1000 },
    );
  });

  test('should display (unassigned) when no assignment exist for case', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary Petition',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
    };
    render(
      <BrowserRouter>
        <CaseDetail caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const title = screen.getByTestId('case-detail-heading');
        expect(title.innerHTML).toEqual('The Beach Boys');

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
      const testCaseDetail: CaseDetailType = {
        caseId: caseId,
        chapter: '15',
        officeName: 'Redondo Beach',
        caseTitle: 'The Beach Boys',
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary Petition',
        dateFiled: '01-04-1962',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianWilsonName, carlWilsonName],
        debtor: {
          name: 'Roger Rabbit',
        },
        debtorAttorney: expectedAttorney,
      };
      const expectedLink = `mailto:${expectedAttorney.email}?subject=${getCaseNumber(
        testCaseDetail.caseId,
      )} - ${testCaseDetail.caseTitle}`;
      render(
        <BrowserRouter>
          <CaseDetail caseDetail={testCaseDetail} />
        </BrowserRouter>,
      );

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
    ['case-detail/1234', 'basic-info-link'],
    ['case-detail/1234/', 'basic-info-link'],
    ['case-detail/1234/court-docket/', 'court-docket-link'],
  ];

  test.each(navRouteTestCases)(
    'should highlight the correct nav link when loading the corresponding url directly in browser',
    async (routePath: string, expectedLink: string) => {
      const testCaseDetail: CaseDetailType = {
        caseId: '080-01-12345',
        chapter: '15',
        officeName: 'Redondo Beach',
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: 'some judge',
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary Petition',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
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
          <CaseDetail caseDetail={testCaseDetail} />
        </MemoryRouter>,
      );

      const caseDocketLink = screen.getByTestId(expectedLink);

      expect(caseDocketLink).toHaveClass('usa-current');
    },
  );

  describe('Fixed navigation area', () => {
    const testCaseDetail: CaseDetailType = {
      caseId: '080-01-12345',
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: 'some judge',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary Petition',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
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

    test('should fix when scrolled at top of viewport', async () => {
      render(
        <BrowserRouter>
          <div className="App" data-testid="app-component-test-id">
            <header
              className="cams-header usa-header-usa-header--basic"
              style={{ minHeight: '100px', height: '100px' }}
              data-testid="cams-header-test-id"
            ></header>
            <CaseDetail caseDetail={testCaseDetail} />
            <div style={{ minHeight: '2000px', height: '2000px' }}></div>
          </div>
        </BrowserRouter>,
      );

      const app = await screen.findByTestId('app-component-test-id');

      await waitFor(() => {
        const pane = document.querySelector('.left-navigation-pane-container');
        expect(pane).toBeInTheDocument();
        expect(pane).not.toHaveClass('fixed');
      });

      const paneBeforeBreak = document.querySelector('.left-navigation-pane-container');
      expect(paneBeforeBreak).toBeInTheDocument();

      window.HTMLElement.prototype.getBoundingClientRect = () =>
        ({
          top: 2,
        }) as DOMRect;
      fireEvent.scroll(app as Element, { target: { scrollTop: 98 } });

      expect(paneBeforeBreak).toBeInTheDocument();
      expect(paneBeforeBreak).not.toHaveClass('fixed');

      window.HTMLElement.prototype.getBoundingClientRect = () =>
        ({
          top: -175,
        }) as DOMRect;
      fireEvent.scroll(app as Element, { target: { scrollTop: 275 } });

      const paneAfterBreak = document.querySelector('.left-navigation-pane-container');
      expect(paneAfterBreak).toBeInTheDocument();
      expect(paneAfterBreak).toHaveClass('fixed');
    });

    test('should render docket search when the feature is turned on and there are docket entries', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });
      const testCaseDocketEntries = [
        {
          sequenceNumber: 2,
          documentNumber: 1,
          dateFiled: '2023-05-07T00:00:00.0000000',
          summaryText: 'Add Judge',
          fullText: 'Docket entry number 1.',
        },
        {
          sequenceNumber: 3,
          dateFiled: '2023-05-07T00:00:00.0000000',
          summaryText: 'Motion',
          fullText: 'Docket entry number 2.',
        },
        {
          sequenceNumber: 4,
          documentNumber: 2,
          dateFiled: '2023-07-07T00:00:00.0000000',
          summaryText: 'Add Attorney',
          fullText: 'Docket entry number 3.',
          documents: [
            {
              fileLabel: '0-0',
              fileSize: 1000,
              fileExt: 'pdf',
              fileUri: 'https://somehost.gov/pdf/0000-111111-3-0-0.pdf',
            },
          ],
        },
      ];
      render(
        <BrowserRouter>
          <CaseDetail caseDetail={testCaseDetail} caseDocketEntries={testCaseDocketEntries} />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const searchInput = document.querySelector('#basic-search-field');
        console.log(document.body);
        expect(searchInput).toBeInTheDocument();
      });
    });
  });

  describe('Docket entry sorter', () => {
    const left: CaseDocketEntry = {
      sequenceNumber: 0,
      dateFiled: '',
      summaryText: '',
      fullText: '',
    };
    const right: CaseDocketEntry = {
      sequenceNumber: 1,
      dateFiled: '',
      summaryText: '',
      fullText: '',
    };
    test('should return the expected sort direction for Newest sort', () => {
      const fn = docketSorterClosure('Newest');
      const expectedValue = 1;
      expect(fn(left, right)).toEqual(expectedValue);
    });
    test('should return the expected sort direction for Oldest sort', () => {
      const fn = docketSorterClosure('Oldest');
      const expectedValue = -1;
      expect(fn(left, right)).toEqual(expectedValue);
    });
  });

  describe('old tests we may have to rewrite', () => {
    const testCaseId = '111-11-12345';

    const testCaseDetail: CaseDetailType = {
      caseId: testCaseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: 'some judge',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary Petition',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
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

    const testCaseDocketEntries: CaseDocket = [
      {
        sequenceNumber: 2,
        documentNumber: 1,
        dateFiled: '2023-05-07T00:00:00.0000000',
        summaryText: 'Add Judge',
        fullText: 'Docket entry number 1.',
      },
      {
        sequenceNumber: 3,
        dateFiled: '2023-05-07T00:00:00.0000000',
        summaryText: 'Motion',
        fullText: 'Docket entry number 2.',
      },
      {
        sequenceNumber: 4,
        documentNumber: 2,
        dateFiled: '2023-07-07T00:00:00.0000000',
        summaryText: 'Add Attorney',
        fullText: 'Docket entry number 3.',
        documents: [
          {
            fileLabel: '0-0',
            fileSize: 1000,
            fileExt: 'pdf',
            fileUri: 'https://somehost.gov/pdf/0000-111111-3-0-0.pdf',
          },
        ],
      },
    ];

    test('should filter the list of docket entries per the search text', async () => {
      const filteredDocketEntries = applySortAndFilters(testCaseDocketEntries, {
        searchString: 'number 2',
        selectedFacets: [],
        sortDirection: 'Oldest',
      });

      if (filteredDocketEntries) {
        expect(filteredDocketEntries.length).toEqual(1);
      }
    });

    test.skip('should filter the list of docket entries per the search text', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });

      // TODO: Need to get the MemoryRouter to work to cause the docket screen to render.
      const routePath = `/case-detail/${testCaseId}/court-docket`;
      // const routePath = `/${testCaseId}/court-docket`;
      // const routePath = '/court-docket';
      render(
        <MemoryRouter initialEntries={[routePath]}>
          <CaseDetail caseDetail={testCaseDetail} caseDocketEntries={testCaseDocketEntries} />
        </MemoryRouter>,
      );

      const searchableDocketId = 'searchable-docket';
      const startingDocket = screen.getByTestId(searchableDocketId);
      expect(startingDocket.childElementCount).toEqual(testCaseDocketEntries.length);

      const searchInput = screen.getByTestId('basic-search-field');
      fireEvent.change(searchInput, { target: { value: 'number 2' } });

      const filteredDocket = screen.getByTestId(searchableDocketId);
      expect(filteredDocket.childElementCount).toEqual(1);
    });

    test.skip('should sort docket entries', async () => {
      vi.spyOn(ReactRouter, 'useParams').mockReturnValue({ caseId: testCaseId });
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });

      const youngestEntry = testCaseDocketEntries[2];
      const middleEntry = testCaseDocketEntries[1];
      const oldestEntry = testCaseDocketEntries[0];
      const sortedListFromApi = [oldestEntry, middleEntry, youngestEntry];

      // TODO: Need to get the MemoryRouter to work to cause the docket screen to render.
      const routePath = '/case-detail/111-11-1234/court-docket';
      //const routePath = `/case-detail/${testCaseId}`;
      render(
        <MemoryRouter initialEntries={[routePath]}>
          <CaseDetail caseDetail={testCaseDetail} caseDocketEntries={sortedListFromApi} />
        </MemoryRouter>,
      );

      await act(async () => {
        const docketLink = screen.getByTestId('court-docket-link');
        expect(docketLink).toBeInTheDocument();
        console.log(document.body.innerHTML);
        //docketLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      /*
      await waitFor(
        () => {
          const loadingIndicator = screen.getByTestId('loading-indicator');
          expect(loadingIndicator).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      */

      /*
      const sortButtonId = 'docket-entry-sort';

      // Check to make sure all the entries are in the HTML list.
      const startingDocket = screen.getByTestId('searchable-docket');
      const sortButton = screen.getByTestId(sortButtonId);
      expect(startingDocket.childElementCount).toEqual(testCaseDocketEntries.length);

      console.log(sortButton);
      */
      /*
      // First Sort - oldest goes to the top of the list.
      fireEvent.click(sortButton);
      if (oldestEntry.documentNumber) {
        expect(screen.getByTestId('docket-entry-0-number').textContent).toEqual(
          oldestEntry.documentNumber?.toString(),
        );
      }
      expect(screen.getByTestId('docket-entry-0-header').textContent).toEqual(
        oldestEntry.dateFiled + ' - ' + oldestEntry.summaryText,
      );
      expect(screen.getByTestId('docket-entry-0-text').textContent).toEqual(oldestEntry.fullText);
      if (oldestEntry.documents) {
        expect(screen.getByTestId('document-unordered-list').childElementCount).toEqual(
          oldestEntry.documents?.length,
        );
      }

      // Second Sort - youngest returns to the top of the list.
      fireEvent.click(sortButton);
      if (youngestEntry.documentNumber) {
        expect(screen.getByTestId('docket-entry-0-number').textContent).toEqual(
          youngestEntry.documentNumber?.toString(),
        );
      }
      expect(screen.getByTestId('docket-entry-0-header').textContent).toEqual(
        youngestEntry.dateFiled + ' - ' + youngestEntry.summaryText,
      );
      expect(screen.getByTestId('docket-entry-0-text').textContent).toEqual(youngestEntry.fullText);
      if (youngestEntry.documents) {
        expect(screen.getByTestId('document-unordered-list').childElementCount).toEqual(
          youngestEntry.documents?.length,
        );
      }
      */
    }, 10000);
  });
});
