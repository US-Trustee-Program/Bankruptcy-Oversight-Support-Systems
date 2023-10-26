import { describe } from 'vitest';
import { render, waitFor, screen, queryByTestId } from '@testing-library/react';
import { CaseDetail } from './CaseDetail';
import { getCaseNumber } from '../utils/formatCaseNumber';
import { CaseDetailType } from '../type-declarations/chapter-15';
import { BrowserRouter } from 'react-router-dom';

const caseId = '101-23-12345';
const brianWilsonName = 'Brian Wilson';
const carlWilsonName = 'Carl Wilson';
const trialAttorneyRole = 'Trial Attorney';

describe('Case Detail screen tests', () => {
  test('should display case title, case number, dates, and assignees for the case', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: caseId,
      chapter: '15',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: [brianWilsonName, carlWilsonName],
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
      closedDate: '01-08-1963',
      assignments: [brianWilsonName, carlWilsonName],
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
      closedDate: '01-08-1963',
      reopenedDate: '04-15-1969',
      assignments: [brianWilsonName, carlWilsonName],
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
      reopenedDate: '04-15-1969',
      closedDate: '08-08-1970',
      assignments: [brianWilsonName, carlWilsonName],
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
});
