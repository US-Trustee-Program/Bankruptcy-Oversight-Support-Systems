import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { describe } from 'vitest';
import { render, waitFor, screen, queryByTestId } from '@testing-library/react';
import CaseDetailScreen from './CaseDetailScreen';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { CaseDetail } from '@common/cams/cases';
import { Debtor, DebtorAttorney } from '@common/cams/parties';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import * as detailHeader from './panels/CaseDetailHeader';
import MockData from '@common/cams/test-utilities/mock-data';

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

describe('Case Detail screen tests', () => {
  const env = process.env;

  type MaybeString = string | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...env,
      CAMS_PA11Y: 'true',
    };
  });

  test('should render CaseDetailHeader', async () => {
    const testCaseDetail: CaseDetail = {
      caseId: caseId,
      dxtrId: '123',
      chapter: '15',
      regionId: '02',
      officeName: 'New York',
      officeCode: '000',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      courtId: '01',
      courtName: 'Court of Law',
      courtDivisionName: 'Manhattan',
      courtDivisionCode: '081',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [brianAssignment, carlAssignment],
      debtor: {
        name: 'Roger Rabbit',
        address1: '123 Rabbithole Lane',
        address2: 'Apt 117',
        address3: 'Suite C',
        cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
      },
      debtorAttorney,
      groupDesignator: '01',
      regionName: 'Test Region',
    };
    const headerSpy = vi.spyOn(detailHeader, 'default');

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(headerSpy).toHaveBeenCalled();
    });
  });

  test('should display case title, case number, dates, assignees, judge name, and debtor for the case', async () => {
    const testCaseDetail: CaseDetail = {
      caseId: caseId,
      dxtrId: '123',
      chapter: '15',
      regionId: '02',
      officeName: 'New York',
      officeCode: '000',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      courtId: '01',
      courtName: 'Court of Law',
      courtDivisionName: 'Manhattan',
      courtDivisionCode: '081',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [brianAssignment, carlAssignment],
      debtor: {
        name: 'Roger Rabbit',
        address1: '123 Rabbithole Lane',
        address2: 'Apt 117',
        address3: 'Suite C',
        cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
      },
      debtorAttorney,
      groupDesignator: '01',
      regionName: 'Test Region',
    };
    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const title = screen.getByTestId('case-detail-heading-title');
        const expectedTitle = ` - ${testCaseDetail.caseTitle}`;
        expect(title.innerHTML).toEqual(expectedTitle);

        const caseNumber = document.querySelector('.case-number');
        expect(caseNumber?.textContent?.trim()).toEqual(caseId);

        const dateFiled = screen.getByTestId('case-detail-filed-date');
        expect(dateFiled).toHaveTextContent('Filed');
        expect(dateFiled).toHaveTextContent('01/04/1962');

        const closedDate = screen.getByTestId('case-detail-closed-date');
        expect(closedDate).toHaveTextContent('Closed by court');
        expect(closedDate).toHaveTextContent('01/08/1963');

        const dismissedDate = screen.getByTestId('case-detail-dismissed-date');
        expect(dismissedDate).toHaveTextContent('Dismissed by court');
        expect(dismissedDate).toHaveTextContent('01/08/1964');

        const chapter = screen.getByTestId('case-chapter');
        expect(chapter.innerHTML).toEqual('Voluntary Chapter&nbsp;15');

        const courtName = screen.getByTestId('court-name-and-district');
        expect(courtName.innerHTML).toEqual(`Court of Law (${testCaseDetail.courtDivisionName})`);

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
        expect(assigneeMap.get(`${brianWilson.name}`)).toEqual(trialAttorneyLabel);
        expect(assigneeMap.get(`${carlWilson.name}`)).toEqual(trialAttorneyLabel);

        const judgeName = screen.getByTestId('case-detail-judge-name');
        expect(judgeName).toHaveTextContent(rickBHartName);

        const debtorName = screen.getByTestId('case-detail-debtor-name');
        expect(debtorName).toHaveTextContent(testCaseDetail.debtor.name);

        const debtorType = screen.getByTestId('case-detail-debtor-type');
        expect(debtorType).toHaveTextContent(testCaseDetail.debtorTypeLabel as string);

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
      const testCaseDetail: CaseDetail = {
        caseId: caseId,
        chapter: '15',
        regionId,
        officeName,
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: rickBHartName,
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianAssignment, carlAssignment],
        debtor: {
          name: 'Roger Rabbit',
        },
        debtorAttorney,
        courtId: '',
        dxtrId: '',
        officeCode: '',
        courtName: '',
        courtDivisionCode: '',
        courtDivisionName: '',
        groupDesignator: '',
        regionName: '',
      };
      render(
        <BrowserRouter>
          <CaseDetailScreen caseDetail={testCaseDetail} />
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
      const testCaseDetail: CaseDetail = {
        caseId: caseId,
        chapter: '15',
        officeName: 'Redondo Beach',
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: rickBHartName,
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianAssignment, carlAssignment],
        debtor: {
          name: 'Roger Rabbit',
          address1,
          address2,
          address3,
          cityStateZipCountry,
        },
        debtorAttorney,
        courtId: '',
        dxtrId: '',
        officeCode: '',
        courtName: '',
        courtDivisionCode: '',
        courtDivisionName: '',
        groupDesignator: '',
        regionId: '',
        regionName: '',
      };
      render(
        <BrowserRouter>
          <CaseDetailScreen caseDetail={testCaseDetail} />
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
      const testCaseDetail: CaseDetail = {
        caseId: caseId,
        chapter: '15',
        officeName: 'Redondo Beach',
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: rickBHartName,
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianAssignment, carlAssignment],
        debtor: {
          name: 'Roger Rabbit',
          ssn,
          taxId,
        },
        debtorAttorney,
        courtId: '',
        dxtrId: '',
        officeCode: '',
        courtName: '',
        courtDivisionCode: '',
        courtDivisionName: '',
        groupDesignator: '',
        regionId: '',
        regionName: '',
      };
      render(
        <BrowserRouter>
          <CaseDetailScreen caseDetail={testCaseDetail} />
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
    const testCaseDetail: CaseDetail = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      closedDate: '01-08-1963',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      dismissedDate: '01-08-1964',
      assignments: [brianAssignment, carlAssignment],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
      courtId: '',
      dxtrId: '',
      officeCode: '',
      courtName: '',
      courtDivisionCode: '',
      courtDivisionName: '',
      groupDesignator: '',
      regionId: '',
      regionName: '',
    };
    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={testCaseDetail} />
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
    const testCaseDetail: CaseDetail = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [brianAssignment, carlAssignment],
      judgeName: 'Honorable Jason Smith',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      debtor: {
        name: 'Roger Rabbit',
      },
      courtId: '',
      dxtrId: '',
      officeCode: '',
      courtName: '',
      courtDivisionCode: '',
      courtDivisionName: '',
      groupDesignator: '',
      regionId: '',
      regionName: '',
    };

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={testCaseDetail} />
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
    const testCaseDetail: CaseDetail = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      closedDate: '01-08-1963',
      assignments: [brianAssignment, carlAssignment],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
      courtId: '',
      dxtrId: '',
      officeCode: '',
      courtName: '',
      courtDivisionCode: '',
      courtDivisionName: '',
      groupDesignator: '',
      regionId: '',
      regionName: '',
    };

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={testCaseDetail} />
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
    const testCaseDetail: CaseDetail = {
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      closedDate: '01-08-1963',
      reopenedDate: '04-15-1969',
      assignments: [brianAssignment, carlAssignment],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
      courtId: '',
      dxtrId: '',
      officeCode: '',
      courtName: '',
      courtDivisionCode: '',
      courtDivisionName: '',
      groupDesignator: '',
      regionId: '',
      regionName: '',
    };

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

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
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      reopenedDate: '04-15-1969',
      closedDate: '08-08-1970',
      assignments: [brianAssignment, carlAssignment],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
      courtId: '',
      dxtrId: '',
      officeCode: '',
      courtName: '',
      courtDivisionCode: '',
      courtDivisionName: '',
      groupDesignator: '',
      regionId: '',
      regionName: '',
    };

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );

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
      caseId: caseId,
      chapter: '15',
      officeName: 'Redondo Beach',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [],
      debtor: {
        name: 'Roger Rabbit',
      },
      debtorAttorney,
      courtId: '',
      dxtrId: '',
      officeCode: '',
      courtName: '',
      courtDivisionCode: '',
      courtDivisionName: '',
      groupDesignator: '',
      regionId: '',
      regionName: '',
    };

    render(
      <BrowserRouter>
        <CaseDetailScreen caseDetail={testCaseDetail} />
      </BrowserRouter>,
    );
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
        caseId: caseId,
        chapter: '15',
        officeName: 'Redondo Beach',
        caseTitle: 'The Beach Boys',
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary',
        dateFiled: '01-04-1962',
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianAssignment, carlAssignment],
        debtor: {
          name: 'Roger Rabbit',
        },
        debtorAttorney: expectedAttorney,
        courtId: '',
        dxtrId: '',
        officeCode: '',
        courtName: '',
        courtDivisionCode: '',
        courtDivisionName: '',
        groupDesignator: '',
        regionId: '',
        regionName: '',
      };

      const expectedLink = `mailto:${expectedAttorney.email}?subject=${getCaseNumber(
        testCaseDetail.caseId,
      )} - ${testCaseDetail.caseTitle}`;

      render(
        <BrowserRouter>
          <CaseDetailScreen caseDetail={testCaseDetail} />
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
    ['case-detail/1234', 'case-overview-link'],
    ['case-detail/1234/', 'case-overview-link'],
    ['case-detail/1234/court-docket/', 'court-docket-link'],
  ];

  test.each(navRouteTestCases)(
    'should highlight the correct nav link when loading the corresponding url directly in browser',
    async (routePath: string, expectedLink: string) => {
      const testCaseDetail: CaseDetail = {
        caseId: '080-01-12345',
        chapter: '15',
        officeName: 'Redondo Beach',
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: 'some judge',
        debtorTypeLabel: 'Corporate Business',
        petitionLabel: 'Voluntary',
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
        courtId: '',
        dxtrId: '',
        officeCode: '',
        courtName: '',
        courtDivisionCode: '',
        courtDivisionName: '',
        groupDesignator: '',
        regionId: '',
        regionName: '',
      };

      // use <MemoryRouter> when you want to manually control the history
      render(
        <MemoryRouter initialEntries={[routePath]}>
          <CaseDetailScreen caseDetail={testCaseDetail} />
        </MemoryRouter>,
      );

      const caseDocketLink = screen.getByTestId(expectedLink);

      expect(caseDocketLink).toHaveClass('usa-current');
    },
  );
});
