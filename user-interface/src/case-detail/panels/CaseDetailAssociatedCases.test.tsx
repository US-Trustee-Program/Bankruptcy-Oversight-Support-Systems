import { render, screen } from '@testing-library/react';
//import { MockData } from '@common/cams/test-utilities/mock-data';
import CaseDetailAssociatedCases from './CaseDetailAssociatedCases';
import { EventCaseReference } from '@common/cams/events';

/*
dxtrId, debtor, officeName, officeCode,
*/
const associatedCasesMock: EventCaseReference[] = [
  {
    caseId: '081-93-87181',
    otherCase: {
      //orderType: 'consolidation',
      //status: 'pending',
      caseId: '081-34-34811',
      caseTitle: 'Hall, Gill and Romero',
      dateFiled: '2016-09-22',
      //divisionCode: '081',
      chapter: '15',
      courtName: 'Southern District of New York',
      courtDivisionName: 'Manhattan',
      regionId: '02',
      regionName: 'NEW YORK',
      //orderDate: '2016-09-28',
      //jobId: 4840265,
      //leadCaseIdHint: null,
    },
    orderDate: '2016-09-28',
    consolidationType: 'substantive',
    documentType: 'CONSOLIDATION_TO',
    id: '4d67d58b-7025-4ceb-ac2b-bee3c00b1ad4',
  },
  {
    caseId: '081-34-34811',
    otherCase: {
      orderType: 'consolidation',
      status: 'pending',
      caseId: '081-93-87181',
      caseTitle: 'Reed, Williams and Marquez',
      dateFiled: '2016-09-22',
      divisionCode: '081',
      chapter: '15',
      courtName: 'Southern District of New York',
      courtDivisionName: 'Manhattan',
      regionId: '02',
      regionName: 'NEW YORK',
      orderDate: '2016-09-28',
      jobId: 4840265,
      leadCaseIdHint: '081-16-12681',
    },
    orderDate: '2016-09-28',
    consolidationType: 'substantive',
    documentType: 'CONSOLIDATION_FROM',
    id: '19a22328-819d-4ee1-a3c9-2077ffe3e339',
  },
  {
    caseId: '081-34-34811',
    otherCase: {
      orderType: 'consolidation',
      status: 'pending',
      caseId: '081-64-09681',
      caseTitle: 'Jackson PLC',
      dateFiled: '2016-09-22',
      divisionCode: '081',
      chapter: '15',
      courtName: 'Southern District of New York',
      courtDivisionName: 'Manhattan',
      regionId: '02',
      regionName: 'NEW YORK',
      orderDate: '2016-09-28',
      jobId: 4840265,
      leadCaseIdHint: '081-16-12681',
    },
    orderDate: '2016-09-28',
    consolidationType: 'substantive',
    documentType: 'CONSOLIDATION_FROM',
    id: '1bd90f17-c3da-4681-88e6-a8b12de36a78',
  },
  {
    caseId: '081-34-34811',
    otherCase: {
      orderType: 'consolidation',
      status: 'pending',
      caseId: '081-55-57121',
      caseTitle: 'Walters-Lynn',
      dateFiled: '2016-09-22',
      divisionCode: '081',
      chapter: '15',
      courtName: 'Southern District of New York',
      courtDivisionName: 'Manhattan',
      regionId: '02',
      regionName: 'NEW YORK',
      orderDate: '2016-09-28',
      jobId: 4840265,
      leadCaseIdHint: '081-16-12681',
    },
    orderDate: '2016-09-28',
    consolidationType: 'substantive',
    documentType: 'CONSOLIDATION_FROM',
    id: '9991a623-633c-4efc-8707-0953eb5a15d6',
  },
];

describe('associated cases tests', () => {
  test('should display loading indicator if loading', async () => {
    render(<CaseDetailAssociatedCases associatedCases={[]} />);

    const loadingIndicator = screen.queryByTestId('loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });

  test('should display associated case table when data exists', async () => {
    render(<CaseDetailAssociatedCases associatedCases={associatedCasesMock} />);
  });

  test('should display lead case in the top of the list.', async () => {});

  test('should display cases in order by case ID.', async () => {});
});
