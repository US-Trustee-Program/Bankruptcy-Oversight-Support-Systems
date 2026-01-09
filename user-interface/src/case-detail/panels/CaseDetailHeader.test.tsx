import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CaseDetailHeader from './CaseDetailHeader';
import CaseDetailScreen from '../CaseDetailScreen';
import MockData from '@common/cams/test-utilities/mock-data';
import { ResourceActions } from '@common/cams/actions';
import { CaseDetail } from '@common/cams/cases';
import * as caseNumber from '@/lib/utils/caseNumber';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';

function basicRender(caseDetail: ResourceActions<CaseDetail>, isLoading: boolean) {
  render(
    <BrowserRouter>
      <CaseDetailHeader caseDetail={caseDetail} isLoading={isLoading} caseId={caseDetail.caseId} />
    </BrowserRouter>,
  );
}

const testCaseDetail = MockData.getCaseDetail({
  override: {
    petitionLabel: 'Voluntary',
  },
});

describe('Case Detail Header tests', () => {
  beforeEach(() => {
    const mockFeatureFlags = {
      [FeatureFlagHook.VIEW_TRUSTEE_ON_CASE]: false,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render loading info when isLoading is true', () => {
    basicRender(testCaseDetail, true);

    const isLoadingH1 = screen.getByTestId('case-detail-heading');

    expect(isLoadingH1).toContainHTML('Loading Case Details...');
  });

  test('should render case detail info when isLoading is false', () => {
    basicRender(testCaseDetail, false);

    const isLoadingH1 = screen.getByTestId('case-detail-heading');
    const isLoadingH2 = screen.getByTestId('case-detail-heading-title');
    const isFinishedH2 = screen.getByTestId('h2-with-case-info');
    const caseChapter = screen.getByTestId('case-chapter');

    expect(isLoadingH1).toContainHTML('Case Detail');
    expect(isLoadingH2.textContent).toContain(testCaseDetail.debtor.name);
    expect(isFinishedH2).toBeInTheDocument();
    expect(caseChapter.innerHTML).toEqual(
      `${testCaseDetail.petitionLabel} Chapter ${testCaseDetail.chapter}`,
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
          <CaseDetailScreen caseDetail={testCaseDetail} caseNotes={[]} />
          <div style={{ minHeight: '2000px', height: '2000px' }}></div>
        </div>
      </BrowserRouter>,
    );

    const app = await screen.findByTestId('app-component-test-id');
    const heading = await screen.findByTestId('case-detail-heading-title');
    expect(heading.textContent).toContain(testCaseDetail.debtor.name);
    const title = await screen.findByTestId('case-detail-heading-title');
    expect(title.textContent).toContain(testCaseDetail.debtor.name);

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
    test('clicking copy button should write caseId to clipboard', async () => {
      const copySpy = vi.spyOn(caseNumber, 'copyCaseNumber').mockImplementation(vi.fn());

      basicRender(testCaseDetail, false);

      const caseIdCopyButton = document.querySelector('#header-case-id');

      fireEvent.click(caseIdCopyButton!);

      expect(copySpy).toHaveBeenCalledWith(testCaseDetail.caseId);
    });
  });
});

describe('feature flag true', () => {
  beforeEach(() => {
    const mockFeatureFlags = {
      [FeatureFlagHook.VIEW_TRUSTEE_ON_CASE]: true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  test('should render properly when true', () => {
    basicRender(testCaseDetail, false);

    const isLoadingH1 = screen.getByTestId('case-detail-heading');
    const isLoadingH2 = screen.getByTestId('case-detail-heading-title');
    const isFinishedH2 = screen.getByTestId('h2-with-case-info');
    const caseChapter = screen.getByTestId('tag-case-chapter');

    expect(isLoadingH1).toHaveClass('case-number');
    expect(isLoadingH1).toHaveTextContent(testCaseDetail.caseId);
    expect(screen.getByTitle('Copy Case ID to clipboard')).toBeInTheDocument();
    expect(isLoadingH2.textContent).toContain(testCaseDetail.debtor.name);
    expect(isFinishedH2).toBeInTheDocument();
    expect(caseChapter.innerHTML).toEqual(
      `${testCaseDetail.petitionLabel} Chapter ${testCaseDetail.chapter}`,
    );
  });

  test('should render lead case icon when case is lead case', () => {
    const leadCaseDetail = MockData.getCaseDetail({
      override: {
        petitionLabel: 'Voluntary',
        consolidation: [
          MockData.getConsolidationReference({ override: { documentType: 'CONSOLIDATION_FROM' } }),
        ],
      },
    });

    basicRender(leadCaseDetail, false);

    const leadIcon = screen.getByTestId('lead-case-icon');
    expect(leadIcon).toBeInTheDocument();
  });

  test('should render member case icon when case is member case', () => {
    const memberCaseDetail = MockData.getCaseDetail({
      override: {
        petitionLabel: 'Voluntary',
        consolidation: [
          MockData.getConsolidationReference({ override: { documentType: 'CONSOLIDATION_TO' } }),
        ],
      },
    });

    basicRender(memberCaseDetail, false);

    const childIcon = screen.getByTestId('member-case-icon');
    expect(childIcon).toBeInTheDocument();
  });

  test('should render transferred case icon when case is transferred', () => {
    const transferredCaseDetail = MockData.getCaseDetail({
      override: {
        petitionLabel: 'Voluntary',
        transfers: [
          {
            documentType: 'TRANSFER_FROM',
            caseId: '081-23-12345',
            orderDate: '2024-01-15',
            otherCase: MockData.getCaseSummary(),
          },
        ],
      },
    });

    basicRender(transferredCaseDetail, false);

    const transferIcon = screen.getByTestId('transfer-icon');
    expect(transferIcon).toBeInTheDocument();
  });

  test('should display tooltip for lead case icon with consolidation type', () => {
    const leadCaseDetail = MockData.getCaseDetail({
      override: {
        petitionLabel: 'Voluntary',
        consolidation: [
          MockData.getConsolidationReference({
            override: { documentType: 'CONSOLIDATION_FROM', consolidationType: 'administrative' },
          }),
        ],
      },
    });

    basicRender(leadCaseDetail, false);

    const leadIcon = screen.getByTestId('lead-case-icon');
    const titleElement = leadIcon.querySelector('title');
    expect(titleElement).toHaveTextContent('Lead case in joint administration');
  });

  test('should display tooltip for member case icon with consolidation type', () => {
    const memberCaseDetail = MockData.getCaseDetail({
      override: {
        petitionLabel: 'Voluntary',
        consolidation: [
          MockData.getConsolidationReference({
            override: { documentType: 'CONSOLIDATION_TO', consolidationType: 'substantive' },
          }),
        ],
      },
    });

    basicRender(memberCaseDetail, false);

    const memberIcon = screen.getByTestId('member-case-icon');
    const titleElement = memberIcon.querySelector('title');
    expect(titleElement).toHaveTextContent('Member case in substantive consolidation');
  });

  test('should display tooltip for transferred case icon', () => {
    const transferredCaseDetail = MockData.getCaseDetail({
      override: {
        petitionLabel: 'Voluntary',
        transfers: [
          {
            documentType: 'TRANSFER_FROM',
            caseId: '081-23-12345',
            orderDate: '2024-01-15',
            otherCase: MockData.getCaseSummary(),
          },
        ],
      },
    });

    basicRender(transferredCaseDetail, false);

    const transferIcon = screen.getByTestId('transfer-icon');
    const titleElement = transferIcon.querySelector('title');
    expect(titleElement).toHaveTextContent('Transferred case');
  });

  test('should display tooltip for lead case icon without consolidation type when empty', () => {
    const leadCaseDetail = MockData.getCaseDetail({
      override: {
        petitionLabel: 'Voluntary',
        consolidation: [
          MockData.getConsolidationReference({
            override: { documentType: 'CONSOLIDATION_FROM', consolidationType: undefined },
          }),
        ],
      },
    });

    basicRender(leadCaseDetail, false);

    const leadIcon = screen.getByTestId('lead-case-icon');
    const titleElement = leadIcon.querySelector('title');
    expect(titleElement).toHaveTextContent('Lead case');
  });

  test('should display tooltip for member case icon without consolidation type when empty', () => {
    const memberCaseDetail = MockData.getCaseDetail({
      override: {
        petitionLabel: 'Voluntary',
        consolidation: [
          MockData.getConsolidationReference({
            override: { documentType: 'CONSOLIDATION_TO', consolidationType: undefined },
          }),
        ],
      },
    });

    basicRender(memberCaseDetail, false);

    const memberIcon = screen.getByTestId('member-case-icon');
    const titleElement = memberIcon.querySelector('title');
    expect(titleElement).toHaveTextContent('Member case');
  });
});

describe('feature flag false', () => {
  beforeEach(() => {
    const mockFeatureFlags = {
      [FeatureFlagHook.VIEW_TRUSTEE_ON_CASE]: false,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  test('should render loading info when isLoading is true and VIEW_TRUSTEE_ON_CASE is disabled', () => {
    basicRender(testCaseDetail, true);

    const isLoadingH1 = screen.getByTestId('case-detail-heading');
    const isLoadingH2 = screen.getByTestId('loading-h2');

    expect(isLoadingH1).toContainHTML('Loading Case Details...');
    expect(isLoadingH2).toBeInTheDocument();
  });

  test('should render properly with false', () => {
    basicRender(testCaseDetail, false);

    const isLoadingH1 = screen.getByTestId('case-detail-heading');
    const isLoadingH2 = screen.getByTestId('case-detail-heading-title');
    const isFinishedH2 = screen.getByTestId('h2-with-case-info');
    const caseChapter = screen.getByTestId('case-chapter');

    expect(isLoadingH1).toContainHTML('Case Detail');
    expect(isLoadingH2.textContent).toContain(testCaseDetail.debtor.name);
    expect(isFinishedH2).toBeInTheDocument();
    expect(caseChapter.innerHTML).toEqual(
      `${testCaseDetail.petitionLabel} Chapter ${testCaseDetail.chapter}`,
    );
  });
});
