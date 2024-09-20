import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CaseDetailHeader from './CaseDetailHeader';
import CaseDetailScreen from '../CaseDetailScreen';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { ResourceActions } from '@common/cams/actions';
import { CaseDetail } from '@common/cams/cases';
import { MockInstance } from 'vitest';
import { copyCaseNumber } from '@/lib/utils/caseNumber';

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

  describe('Testing the clipboard with caseId', () => {
    let writeTextMock: MockInstance<(data: string) => Promise<void>> = vi
      .fn()
      .mockResolvedValue('');

    beforeEach(() => {
      if (!navigator.clipboard) {
        Object.assign(navigator, {
          clipboard: {
            writeText: writeTextMock,
          },
        });
      } else {
        writeTextMock = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
      }
    });

    test('clicking copy button should write caseId to clipboard', async () => {
      basicRender(testCaseDetail, false);

      const caseIdCopyButton = document.querySelector('#header-case-id');

      fireEvent.click(caseIdCopyButton!);

      expect(writeTextMock).toHaveBeenCalledWith(testCaseDetail.caseId);
    });

    test('should only copy to clipboard if we have a valid case number', () => {
      copyCaseNumber('abcdefg#!@#$%');
      expect(writeTextMock).not.toHaveBeenCalled();

      copyCaseNumber(testCaseDetail.caseId);
      expect(writeTextMock).toHaveBeenCalledWith(testCaseDetail.caseId);
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
  });
});
