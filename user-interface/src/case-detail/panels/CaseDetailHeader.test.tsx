import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CaseDetailHeader from './CaseDetailHeader';
import { CaseDetailType } from '@/lib/type-declarations/chapter-15';
import CaseDetail from '../CaseDetailScreen';

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
    expect(caseChapter.innerHTML).toEqual('Voluntary Chapter&nbsp;15');
  });

  test('should fix header in place when screen is scrolled and header hits the top of the screen', async () => {
    const testCaseDetail: CaseDetailType = {
      caseId: '000-11-22222',
      chapter: '15',
      regionId: '02',
      officeName: 'New York',
      caseTitle: 'The Beach Boys',
      dateFiled: '01-04-1962',
      judgeName: 'Ms. Judge',
      courtName: 'Court of Law',
      courtDivisionName: 'Manhattan',
      debtorTypeLabel: 'Corporate Business',
      petitionLabel: 'Voluntary',
      closedDate: '01-08-1963',
      dismissedDate: '01-08-1964',
      assignments: ['Mr. Frank', 'Ms. Jane'],
      debtor: {
        name: 'Roger Rabbit',
        address1: '123 Rabbithole Lane',
        address2: '',
        address3: '',
        cityStateZipCountry: 'Redondo Beach CA 90111 USA',
      },
      debtorAttorney: {
        name: 'Jane Doe',
        address1: 'Somewhere nice',
        cityStateZipCountry: 'where its sunny all the time',
        phone: '111-555-1234',
      },
    };

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
    await waitFor(
      async () => {
        const title = await screen.findByTestId('case-detail-heading');
        expect(title.innerHTML).toEqual('The Beach Boys');
      },
      { timeout: 1000 },
    );

    let normalHeader = await screen.findByTestId('case-detail-header');
    expect(normalHeader).toBeInTheDocument();

    window.HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        top: 2,
      }) as DOMRect;
    fireEvent.scroll(app as Element, { target: { scrollTop: 98 } });

    expect(normalHeader).toBeInTheDocument();
    expect(normalHeader).not.toHaveClass('fixed');

    window.HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        top: -175,
      }) as DOMRect;
    fireEvent.scroll(app as Element, { target: { scrollTop: 275 } });

    const fixedHeader = await screen.findByTestId('case-detail-fixed-header');
    expect(normalHeader).not.toBeInTheDocument();
    expect(fixedHeader).toBeInTheDocument();

    const camsHeader = await screen.findByTestId('cams-header-test-id');
    window.HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        top: 100,
      }) as DOMRect;
    camsHeader.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 150,
    } as DOMRect);
    fixedHeader.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 100,
    } as DOMRect);
    fireEvent.scroll(app as Element, { target: { scrollTop: 0 } });

    await waitFor(
      async () => {
        normalHeader = await screen.findByTestId('case-detail-header');
        expect(normalHeader).toBeInTheDocument();
        expect(fixedHeader).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});
