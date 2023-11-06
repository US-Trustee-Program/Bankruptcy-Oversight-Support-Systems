import { describe } from 'vitest';
import { render, waitFor, screen, queryByTestId } from '@testing-library/react';
import { CaseDetail } from './CaseDetail';
import { getCaseNumber } from '@/utils/formatCaseNumber';
import { CaseDetailType, Debtor } from '@/type-declarations/chapter-15';
import { BrowserRouter } from 'react-router-dom';

const caseId = '101-23-12345';
const brianWilsonName = 'Brian Wilson';
const carlWilsonName = 'Carl Wilson';
const trialAttorneyRole = 'Trial Attorney';

const rickBHartName = 'Rick B Hart';
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
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
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
        expect(chapter.innerHTML).toEqual('Chapter 15');

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
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: rickBHartName,
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
        caseTitle: 'The Beach Boys',
        dateFiled: '01-04-1962',
        judgeName: rickBHartName,
        closedDate: '01-08-1963',
        dismissedDate: '01-08-1964',
        assignments: [brianWilsonName, carlWilsonName],
        debtor: {
          name: 'Roger Rabbit',
          ssn,
          taxId,
        },
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
              expect(noTaxIdsElement).toHaveTextContent('No tax identification is available.');
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
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [brianWilsonName, carlWilsonName],
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
        const judgeName = screen.getByTestId('case-detail-judge-name');
        expect(judgeName).toHaveTextContent('No judge assigned');
      },
      { timeout: 5000 },
    );
  }, 20000);

  test('should not display case dismissed date if not supplied in api response', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      closedDate: '01-08-1963',
      assignments: [brianWilsonName, carlWilsonName],
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
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      closedDate: '01-08-1963',
      reopenedDate: '04-15-1969',
      assignments: [brianWilsonName, carlWilsonName],
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
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      reopenedDate: '04-15-1969',
      closedDate: '08-08-1970',
      assignments: [brianWilsonName, carlWilsonName],
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
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: rickBHartName,
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [],
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
        const title = screen.getByTestId('case-detail-heading');
        expect(title.innerHTML).toEqual('The Beach Boys');

        const unassignedElement = document.querySelector('.unassigned-placeholder');
        expect(unassignedElement).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  }, 20000);
});
