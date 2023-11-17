import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CaseDetailHeader from './CaseDetailHeader';
import { CaseDetailType } from '@/lib/type-declarations/chapter-15';

describe('Case Detail Header tests', () => {
  const testCaseDetail: CaseDetailType = {
    caseId: '1234',
    chapter: '15',
    caseTitle: 'The Beach Boys',
    courtName: 'Court of Law',
    courtDivisionName: 'Manhattan',
    regionId: '02',
    officeName: 'New York',
    dateFiled: '01-04-1962',
    judgeName: 'Mr. Judge',
    debtorTypeLabel: 'Corporate Business',
    petitionLabel: 'Voluntary',
    closedDate: '01-08-1963',
    dismissedDate: '01-08-1964',
    assignments: ['sally', 'joe'],
    debtor: {
      name: 'Roger Rabbit',
      address1: '123 Rabbithole Lane',
      address2: 'Apt 117',
      address3: 'Suite C',
      cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
    },
  };

  test('should render loading info when isLoading is true', () => {
    render(
      <BrowserRouter>
        <CaseDetailHeader
          caseDetail={testCaseDetail}
          isLoading={true}
          caseId={testCaseDetail.caseId}
        />
      </BrowserRouter>,
    );

    const isLoadingH1 = screen.getByTestId('case-detail-heading');
    const isLoadingH2 = screen.getByTestId('loading-h2');

    expect(isLoadingH1).toContainHTML('Loading Case Details...');
    expect(isLoadingH2).toBeInTheDocument();
  });

  test('should render case detail info when isLoading is false', () => {
    render(
      <BrowserRouter>
        <CaseDetailHeader
          caseDetail={testCaseDetail}
          isLoading={false}
          caseId={testCaseDetail.caseId}
        />
      </BrowserRouter>,
    );

    const isLoadingH1 = screen.getByTestId('case-detail-heading');
    const isFinishedH2 = screen.getByTestId('h2-with-case-info');
    const caseChapter = screen.getByTestId('case-chapter');

    expect(isLoadingH1).toContainHTML('The Beach Boys');
    expect(isFinishedH2).toBeInTheDocument();
    expect(caseChapter.textContent).toEqual('Voluntary Chapter 15');
  });
});
