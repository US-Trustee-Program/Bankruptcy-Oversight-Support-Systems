import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as useLocationTracker from '@/lib/hooks/UseLocationTracker';
import CaseDetailHeader from './CaseDetailHeader';
import CaseDetailScreen from '../CaseDetailScreen';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { ResourceActions } from '@common/cams/actions';
import { CaseDetail } from '@common/cams/cases';

function basicRender(caseDetail: ResourceActions<CaseDetail>, isLoading: boolean) {
  render(
    <BrowserRouter>
      <CaseDetailHeader caseDetail={caseDetail} isLoading={isLoading} caseId={caseDetail.caseId} />
    </BrowserRouter>,
  );
}

describe('Case Detail Header tests', () => {
  const testCaseDetail = MockData.getCaseDetail();

  test('should render loading info when isLoading is true', () => {
    basicRender(testCaseDetail, true);

    const isLoadingH1 = screen.getByTestId('case-detail-heading');
    const isLoadingH2 = screen.getByTestId('loading-h2');

    expect(isLoadingH1).toContainHTML('Loading Case Details...');
    expect(isLoadingH2).toBeInTheDocument();
  });

  test('should render case detail info when isLoading is false', () => {
    basicRender(testCaseDetail, false);

    const isLoadingH1 = screen.getByTestId('case-detail-heading');
    const isLoadingH2 = screen.getByTestId('case-detail-heading-title');
    const isFinishedH2 = screen.getByTestId('h2-with-case-info');
    const caseChapter = screen.getByTestId('case-chapter');

    expect(isLoadingH1).toContainHTML('Case Detail');
    expect(isLoadingH2).toContainHTML(testCaseDetail.caseTitle);
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
        const heading = await screen.findByTestId('case-detail-heading-title');
        expect(heading.innerHTML).toEqual(` - ${testCaseDetail.caseTitle}`);
      },
      { timeout: 1000 },
    );
    await waitFor(async () => {
      const title = await screen.findByTestId('case-detail-heading-title');
      expect(title.innerHTML).toEqual(` - ${testCaseDetail.caseTitle}`);
    });

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

  describe('back link tests', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const backLinkTestCases = [
      ['/my-cases', '', 'My Cases'],
      ['/search', 'CAMS_WINDOW_012', 'Case Search'],
      ['/staff-assignment', 'CAMS_WINDOW_012', 'Staff Assignment'],
      ['/data-verification', 'CAMS_WINDOW_345', 'Data Verification'],
      ['/foobar', 'CAMS_WINDOW_678', 'Case List'],
    ];

    test.each(backLinkTestCases)(
      'back link should be setup to link back to Search in tab CAMS_WINDOW_012',
      (previousLocation: string, homeTab: string, displayText: string) => {
        vi.spyOn(useLocationTracker, 'default').mockImplementation(() => {
          return {
            previousLocation,
            homeTab,
            updateLocation: vi.fn(),
          };
        });

        basicRender(testCaseDetail, false);

        const backLink = document.querySelector('.back-button');
        expect(backLink).toHaveAttribute('href', previousLocation);
        expect(backLink).toHaveAttribute('target', homeTab);
        expect(backLink).toHaveTextContent(`Back to ${displayText}`);
      },
    );
  });
});
