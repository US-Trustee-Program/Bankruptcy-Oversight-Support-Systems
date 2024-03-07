import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CaseDetailHeader from './CaseDetailHeader';
import CaseDetailScreen from '../CaseDetailScreen';
import { MockData } from '@common/cams/test-utilities/mock-data';

describe('Case Detail Header tests', () => {
  const testCaseDetail = MockData.getCaseDetail();

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

    expect(isLoadingH1).toContainHTML(testCaseDetail.caseTitle);
    expect(isFinishedH2).toBeInTheDocument();
    expect(caseChapter.innerHTML).toEqual(
      `${testCaseDetail.petitionLabel} Chapter&nbsp;${testCaseDetail.chapter}`,
    );
  });

  test('should fix header in place when screen is scrolled and header hits the top of the screen', async () => {
    render(
      <BrowserRouter>
        <div className="App" data-testid="app-component-test-id">
          <header
            className="cams-header usa-header-usa-header--basic"
            style={{ minHeight: '100px', height: '100px' }}
            data-testid="cams-header-test-id"
          ></header>
          <CaseDetailScreen caseDetail={testCaseDetail} />
          <div style={{ minHeight: '2000px', height: '2000px' }}></div>
        </div>
      </BrowserRouter>,
    );

    const app = await screen.findByTestId('app-component-test-id');
    await waitFor(
      async () => {
        const title = await screen.findByTestId('case-detail-heading');
        expect(title.innerHTML).toEqual(testCaseDetail.caseTitle);
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
