import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  TrusteeMatchVerificationAccordion,
  TrusteeMatchVerificationAccordionProps,
} from './TrusteeMatchVerificationAccordion';
import {
  TrusteeMatchVerification,
  TrusteeMatchVerificationListItem,
} from '@common/cams/trustee-match-verification';
import { CandidateScore } from '@common/cams/dataflow-events';
import { taskType, orderStatusType } from '@/lib/utils/labels';
import MockData from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { TrusteeSearchResult } from '@common/cams/trustee-search';

const fieldHeaders = ['Court District', 'Order Filed', 'Task Type', 'Task Status'];

const sampleOrder: TrusteeMatchVerificationListItem = {
  id: 'case-001:john doe',
  documentType: 'TRUSTEE_MATCH_VERIFICATION',
  taskType: 'trustee-match',
  caseId: '081-22-11111',
  courtId: '0881',
  status: 'pending',
  mismatchReason: 'HIGH_CONFIDENCE_MATCH',
  dxtrTrustee: { fullName: 'John Doe' },
  preselectedCandidate: null,
  candidateCount: 0,
  taskDate: '2026-01-15T10:00:00.000Z',
};

// sampleOrder as a full TrusteeMatchVerification (used in detail mock responses)
const sampleOrderDetail: TrusteeMatchVerification = {
  id: 'case-001:john doe',
  documentType: 'TRUSTEE_MATCH_VERIFICATION',
  taskType: 'trustee-match',
  caseId: '081-22-11111',
  courtId: '0881',
  status: 'pending',
  mismatchReason: 'HIGH_CONFIDENCE_MATCH',
  dxtrTrustee: { fullName: 'John Doe' },
  matchCandidates: [],
  updatedOn: '2026-01-15T10:00:00.000Z',
  updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
  createdOn: '2026-01-15T10:00:00.000Z',
  createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
  taskDate: '2026-01-15T10:00:00.000Z',
};

// The candidate that sampleOrderWithCandidates uses
const candidateJaneSmith: CandidateScore = {
  trusteeId: 'trustee-1',
  trusteeName: 'Jane Smith',
  totalScore: 95,
  addressScore: 90,
  districtDivisionScore: 100,
  chapterScore: 95,
};

const sampleOrderWithCandidates: TrusteeMatchVerificationListItem = {
  ...sampleOrder,
  preselectedCandidate: { trusteeId: 'trustee-1', trusteeName: 'Jane Smith' },
  candidateCount: 1,
};

// Full detail for sampleOrderWithCandidates (returned by getTrusteeMatchVerificationDetail)
const sampleOrderWithCandidatesDetail: TrusteeMatchVerification = {
  ...sampleOrderDetail,
  matchCandidates: [candidateJaneSmith],
};

function renderWithProps(props: Partial<TrusteeMatchVerificationAccordionProps> = {}) {
  const defaultProps: TrusteeMatchVerificationAccordionProps = {
    order: sampleOrder,
    taskType,
    statusType: orderStatusType,
    fieldHeaders,
    hidden: false,
    onOrderUpdate: vi.fn(),
  };
  return render(
    <BrowserRouter>
      <TrusteeMatchVerificationAccordion {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

/** Clicks the accordion expand button for the given order id, triggering handleExpand. */
async function expandAccordion(orderId: string) {
  const button = screen.getByTestId(`accordion-button-order-list-${orderId}`);
  fireEvent.click(button);
  // Wait for loading spinner to appear and then disappear (or for content to be ready)
  await waitFor(() => {
    expect(screen.queryByText('Loading candidate details...')).not.toBeInTheDocument();
  });
}

/** Mocks getTrusteeMatchVerificationDetail to return the given detail, then expands. */
async function mockDetailAndExpand(detail: TrusteeMatchVerification) {
  vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockResolvedValue({ data: detail } as never);
  await expandAccordion(detail.id);
}

describe('TrusteeMatchVerificationAccordion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // intentionally empty — cleanup is in beforeEach
  });

  test('should render accordion heading with court, date, task type, and status', () => {
    renderWithProps();

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain(sampleOrder.courtId);
    expect(heading.textContent).toContain('01/15/2026');
    expect(heading.textContent).toContain('Trustee Mismatch');
    expect(heading.textContent).toContain('Pending Review');
  });

  test('should render court name when courts prop is provided', () => {
    renderWithProps({
      courts: [
        {
          courtId: '0881',
          courtName: 'Southern District of New York',
          officeName: '',
          officeCode: '',
          courtDivisionCode: '081',
          courtDivisionName: 'Manhattan',
          groupDesignator: '',
          regionId: '',
          regionName: '',
        },
      ],
    });

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('Southern District of New York');
  });

  test('should render case link, trustee name, and no-match message in content', () => {
    renderWithProps();

    const link = screen.getByRole('link', { name: /22-11111/, hidden: true });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', `/case-detail/${sampleOrder.caseId}`);
    expect(link).toHaveAttribute('target', '_blank');

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('John Doe');

    const searchButton = screen.getByRole('button', { name: /Search for a trustee/, hidden: true });
    expect(searchButton).toBeInTheDocument();
    expect(searchButton.closest('.search-link-container')).toHaveTextContent(
      'There are no suggested matches in CAMS.',
    );
  });

  test('should render candidate-info section with Confirm Match button for pending order', async () => {
    renderWithProps({ order: sampleOrderWithCandidates });
    await mockDetailAndExpand(sampleOrderWithCandidatesDetail);

    const candidateInfo = screen.getByTestId('candidate-info');
    expect(candidateInfo).toBeInTheDocument();
    expect(screen.getByTestId('candidate-name-trustee-1').textContent).toContain('Jane Smith');
    expect(screen.getByTestId('approve-candidate-trustee-1')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Search for a trustee/, hidden: true }),
    ).not.toBeInTheDocument();
  });

  test('should NOT render candidate-info section for approved order', () => {
    renderWithProps({ order: { ...sampleOrderWithCandidates, status: 'approved' } });

    expect(screen.queryByTestId('candidate-info')).not.toBeInTheDocument();
  });

  test('should render resolved statement for approved order with trustee name and case link', () => {
    renderWithProps({
      order: {
        ...sampleOrderWithCandidates,
        status: 'approved',
        resolvedTrusteeId: 'trustee-1',
        resolvedTrusteeName: 'Jane Smith',
      },
    });

    const resolved = screen.getByTestId('resolved-statement');
    expect(resolved.textContent).toContain('Jane Smith');
    expect(resolved.textContent).toContain('was appointed to case');

    const link = screen.getByRole('link', { name: /22-11111/, hidden: true });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', `/case-detail/${sampleOrder.caseId}`);
    expect(link).toHaveAttribute('target', '_blank');

    expect(screen.queryByTestId('approve-candidate-trustee-1')).not.toBeInTheDocument();
  });

  test('clicking Match Trustee calls patchTrusteeVerificationOrderApproval with correct args', async () => {
    vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
    renderWithProps({ order: sampleOrderWithCandidates });
    await mockDetailAndExpand(sampleOrderWithCandidatesDetail);

    fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
    const modalSubmit = document.getElementById(
      `trustee-confirmation-modal-${sampleOrderWithCandidates.id}-submit-button`,
    );
    fireEvent.click(modalSubmit!);

    await waitFor(() => {
      expect(Api2.patchTrusteeVerificationOrderApproval).toHaveBeenCalledWith(
        sampleOrderWithCandidates.id,
        'trustee-1',
        'Jane Smith',
      );
    });
  });

  test('calls onOrderUpdate with success alert and updated order on approve success', async () => {
    vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
    const onOrderUpdate = vi.fn();
    renderWithProps({ order: sampleOrderWithCandidates, onOrderUpdate });
    await mockDetailAndExpand(sampleOrderWithCandidatesDetail);

    fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
    const modalSubmit = document.getElementById(
      `trustee-confirmation-modal-${sampleOrderWithCandidates.id}-submit-button`,
    );
    fireEvent.click(modalSubmit!);

    await waitFor(() => {
      expect(onOrderUpdate).toHaveBeenCalledWith(
        {
          message: 'Trustee Jane Smith appointed to case 22-11111.',
          type: UswdsAlertStyle.Success,
          timeOut: 8,
        },
        {
          ...sampleOrderWithCandidates,
          status: 'approved',
          resolvedTrusteeId: 'trustee-1',
          resolvedTrusteeName: 'Jane Smith',
        },
      );
    });
  });

  test('calls onOrderUpdate with error alert on approve failure', async () => {
    vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockRejectedValue(
      new Error('Network error'),
    );
    const onOrderUpdate = vi.fn();
    renderWithProps({ order: sampleOrderWithCandidates, onOrderUpdate });
    await mockDetailAndExpand(sampleOrderWithCandidatesDetail);

    fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
    const modalSubmit = document.getElementById(
      `trustee-confirmation-modal-${sampleOrderWithCandidates.id}-submit-button`,
    );
    fireEvent.click(modalSubmit!);

    await waitFor(() => {
      expect(onOrderUpdate).toHaveBeenCalledWith(
        { message: 'Failed to confirm trustee match.', type: UswdsAlertStyle.Error, timeOut: 8 },
        sampleOrderWithCandidates,
      );
    });
  });

  test('should render search link with no-other-matches message for readonly order with candidate', async () => {
    const readonlyOrder: TrusteeMatchVerificationListItem = {
      ...sampleOrderWithCandidates,
      status: 'rejected',
      resolvedTrusteeId: undefined,
    };
    const readonlyDetail: TrusteeMatchVerification = {
      ...sampleOrderWithCandidatesDetail,
      status: 'rejected',
      resolvedTrusteeId: undefined,
    };
    renderWithProps({ order: readonlyOrder });
    await mockDetailAndExpand(readonlyDetail);

    const searchButton = screen.getByRole('button', {
      name: /Search for a different trustee\./,
      hidden: true,
    });
    expect(searchButton).toBeInTheDocument();
    expect(searchButton.closest('.search-link-container')).toHaveTextContent(
      'There are no other suggested matches in CAMS.',
    );
  });

  test('should render "Search for a different trustee." link when match candidates exist', async () => {
    const orderWithCandidate: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      preselectedCandidate: { trusteeId: 'trustee-1', trusteeName: 'Jane Smith' },
      candidateCount: 1,
    };
    const detailWithCandidate: TrusteeMatchVerification = {
      ...sampleOrderDetail,
      matchCandidates: [
        {
          trusteeId: 'trustee-1',
          trusteeName: 'Jane Smith',
          totalScore: 95,
          addressScore: 90,
          districtDivisionScore: 100,
          chapterScore: 95,
        },
      ],
    };
    renderWithProps({ order: orderWithCandidate });
    await mockDetailAndExpand(detailWithCandidate);

    const searchButton = screen.getByRole('button', {
      name: /Search for a different trustee/,
      hidden: true,
    });
    expect(searchButton).toBeInTheDocument();
  });

  test.each([
    { status: 'approved' as const, label: 'Verified' },
    { status: 'rejected' as const, label: 'Rejected' },
  ])('should render "$label" status label for $status order', ({ status, label }) => {
    renderWithProps({ order: { ...sampleOrder, status } });

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain(label);
  });

  test('should not be visible when hidden is true', () => {
    renderWithProps({ hidden: true });

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading).not.toBeVisible();
  });

  test('should render DXTR trustee legacy address with line breaks between multiple lines', async () => {
    const orderWithAddress: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      dxtrTrustee: {
        fullName: 'John Doe',
        legacy: {
          address1: '123 Main St',
          address2: 'Suite 200',
          cityStateZipCountry: 'New York, NY 10001',
          phone: '555-1234',
          email: 'john@example.com',
        },
      },
    };
    renderWithProps({ order: orderWithAddress });

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('123 Main St');
    expect(content.textContent).toContain('Suite 200');
    expect(content.textContent).toContain('New York, NY 10001');
    expect(content.textContent).toContain('555-1234');
  });

  test('should render match candidate with full address, phone extension, and multiple appointments', async () => {
    const candidateWithAddress: CandidateScore = {
      trusteeId: 'trustee-1',
      trusteeName: 'Jane Smith',
      totalScore: 95,
      addressScore: 90,
      districtDivisionScore: 100,
      chapterScore: 95,
      address: {
        address1: '456 Oak Ave',
        address2: 'Suite 100',
        city: 'Boston',
        state: 'MA',
        zipCode: '02101',
        countryCode: 'US',
      },
      phone: { number: '555-5678', extension: '123' },
      email: 'jane@example.com',
      appointments: [
        MockData.getTrusteeAppointment({
          courtName: 'Southern District',
          courtDivisionName: 'Manhattan',
        }),
        MockData.getTrusteeAppointment({
          courtName: 'Eastern District',
          courtDivisionName: 'Brooklyn',
        }),
      ],
    };
    const orderWithCandidate: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      preselectedCandidate: { trusteeId: 'trustee-1', trusteeName: 'Jane Smith' },
      candidateCount: 1,
    };
    const detailWithCandidate: TrusteeMatchVerification = {
      ...sampleOrderDetail,
      matchCandidates: [candidateWithAddress],
    };
    renderWithProps({ order: orderWithCandidate });
    await mockDetailAndExpand(detailWithCandidate);

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('456 Oak Ave');
    expect(content.textContent).toContain('Boston, MA 02101');
    expect(content.textContent).toContain('555-5678 x123');
    expect(content.textContent).toContain('Southern District');
    expect(content.textContent).toContain('Eastern District');
  });

  test('should render read-only candidate table for rejected order, selecting highest-scoring candidate', async () => {
    const candidates: CandidateScore[] = [
      {
        trusteeId: 'trustee-medium',
        trusteeName: 'Medium Score',
        totalScore: 70,
        addressScore: 70,
        districtDivisionScore: 70,
        chapterScore: 70,
      },
      {
        trusteeId: 'trustee-high',
        trusteeName: 'High Score',
        totalScore: 90,
        addressScore: 95,
        districtDivisionScore: 90,
        chapterScore: 85,
        address: {
          address1: '2 High Ave',
          city: 'Buffalo',
          state: 'NY',
          zipCode: '14201',
          countryCode: 'US',
        },
        phone: { number: '555-0002', extension: '99' },
        email: 'high@example.com',
        appointments: [
          MockData.getTrusteeAppointment({ courtName: 'Southern District' }),
          MockData.getTrusteeAppointment({ courtName: 'Northern District' }),
        ],
      },
      {
        trusteeId: 'trustee-low',
        trusteeName: 'Low Score',
        totalScore: 50,
        addressScore: 40,
        districtDivisionScore: 60,
        chapterScore: 50,
      },
    ];
    const rejectedOrder: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      status: 'rejected',
      preselectedCandidate: { trusteeId: 'trustee-high', trusteeName: 'High Score' },
      candidateCount: 3,
    };
    const rejectedDetail: TrusteeMatchVerification = {
      ...sampleOrderDetail,
      status: 'rejected',
      matchCandidates: candidates,
    };
    renderWithProps({ order: rejectedOrder });
    await mockDetailAndExpand(rejectedDetail);

    // Branch B renders a Link (not a button) and no approve-button
    expect(screen.queryByTestId('approve-candidate-trustee-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('candidate-info')).not.toBeInTheDocument();

    // Highest-scoring candidate is selected
    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('High Score');
    expect(content.textContent).not.toContain('Low Score');
    expect(content.textContent).toContain('2 High Ave');
    expect(content.textContent).toContain('Buffalo, NY 14201');
    expect(content.textContent).toContain('555-0002');
  });

  test('should render Branch B with "Not Provided" for phone and email when candidate has no enrichment', async () => {
    const bareCandidate: CandidateScore = {
      trusteeId: 'trustee-bare',
      trusteeName: 'Bare Candidate',
      totalScore: 80,
      addressScore: 80,
      districtDivisionScore: 80,
      chapterScore: 80,
    };
    const rejectedOrder: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      status: 'rejected',
      preselectedCandidate: { trusteeId: 'trustee-bare', trusteeName: 'Bare Candidate' },
      candidateCount: 1,
    };
    const rejectedDetail: TrusteeMatchVerification = {
      ...sampleOrderDetail,
      status: 'rejected',
      matchCandidates: [bareCandidate],
    };
    renderWithProps({ order: rejectedOrder });
    await mockDetailAndExpand(rejectedDetail);

    expect(screen.queryByTestId('approve-candidate-trustee-1')).not.toBeInTheDocument();
    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('Bare Candidate');
    expect(content.textContent).toContain('Not Provided');
  });

  test('should render phone without extension in Branch B (readonly with candidate)', async () => {
    const candidateWithPhone: CandidateScore = {
      trusteeId: 'trustee-1',
      trusteeName: 'No Extension',
      totalScore: 80,
      addressScore: 80,
      districtDivisionScore: 80,
      chapterScore: 80,
      phone: { number: '555-7777' },
    };
    const rejectedOrder: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      status: 'rejected',
      preselectedCandidate: { trusteeId: 'trustee-1', trusteeName: 'No Extension' },
      candidateCount: 1,
    };
    const rejectedDetail: TrusteeMatchVerification = {
      ...sampleOrderDetail,
      status: 'rejected',
      matchCandidates: [candidateWithPhone],
    };
    renderWithProps({ order: rejectedOrder });
    await mockDetailAndExpand(rejectedDetail);

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('01/15/2026');

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('555-7777');
    expect(content.textContent).not.toContain(' x');
  });

  test('should render match candidate phone without extension', async () => {
    const candidateWithPhone: CandidateScore = {
      trusteeId: 'trustee-2',
      trusteeName: 'Bob Johnson',
      totalScore: 80,
      addressScore: 75,
      districtDivisionScore: 90,
      chapterScore: 80,
      phone: { number: '555-9999' },
    };
    const orderWithCandidate: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      preselectedCandidate: { trusteeId: 'trustee-2', trusteeName: 'Bob Johnson' },
      candidateCount: 1,
    };
    const detailWithCandidate: TrusteeMatchVerification = {
      ...sampleOrderDetail,
      matchCandidates: [candidateWithPhone],
    };
    renderWithProps({ order: orderWithCandidate });
    await mockDetailAndExpand(detailWithCandidate);

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('555-9999');
    expect(content.textContent).not.toContain('x555');
  });

  describe('reject flow', () => {
    test('does not render reject-button for pending order with candidate', async () => {
      renderWithProps({ order: sampleOrderWithCandidates });
      await mockDetailAndExpand(sampleOrderWithCandidatesDetail);

      expect(screen.getByTestId('approve-candidate-trustee-1')).toBeInTheDocument();
      expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    });

    test('reject-button does not appear for non-pending orders (Branch B)', async () => {
      const rejectedOrder: TrusteeMatchVerificationListItem = {
        ...sampleOrderWithCandidates,
        status: 'rejected',
      };
      const rejectedDetail: TrusteeMatchVerification = {
        ...sampleOrderWithCandidatesDetail,
        status: 'rejected',
      };
      renderWithProps({ order: rejectedOrder });
      await mockDetailAndExpand(rejectedDetail);

      expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    });
  });

  describe('manual trustee search flow', () => {
    const manualSearchMockData: TrusteeSearchResult[] = [
      { trusteeId: 'manual-trustee-1', name: 'Manual Match', appointments: [], matchType: 'exact' },
    ];

    function setupSearchMocks() {
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: manualSearchMockData });
    }

    // Integration helper: opens search modal, searches, selects, and confirms
    async function searchAndSelectTrustee() {
      const searchButton = screen.getByRole('button', {
        name: /Search for a trustee/,
        hidden: true,
      });
      fireEvent.click(searchButton);

      await waitFor(() => {
        const wrapper = document.getElementById(`trustee-search-modal-${sampleOrder.id}-wrapper`);
        expect(wrapper).toHaveClass('is-visible');
      });

      const comboBoxId = `trustee-search-combobox-${sampleOrder.id}`;
      fireEvent.click(document.getElementById(`${comboBoxId}-expand`)!);
      fireEvent.change(
        document.getElementById(`${comboBoxId}-combo-box-input`) as HTMLInputElement,
        { target: { value: 'manual' } },
      );

      await waitFor(() => {
        expect(screen.getByTestId(`${comboBoxId}-option-item-0`)).toBeVisible();
      });
      fireEvent.click(screen.getByTestId(`${comboBoxId}-option-item-0`));

      const submitButton = screen.getByTestId(
        `button-trustee-search-modal-${sampleOrder.id}-submit-button`,
      );
      await waitFor(() => expect(submitButton).toBeEnabled());
      fireEvent.click(submitButton);
    }

    test('should render search button (not a Link) for no-candidates case', () => {
      renderWithProps();

      const searchButton = screen.getByRole('button', {
        name: /Search for a trustee/,
        hidden: true,
      });
      expect(searchButton).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /Search for a trustee/, hidden: true }),
      ).not.toBeInTheDocument();
    });

    test('clicking search button opens the TrusteeSearchModal', async () => {
      renderWithProps();

      const searchButton = screen.getByRole('button', {
        name: /Search for a trustee/,
        hidden: true,
      });
      fireEvent.click(searchButton);

      await waitFor(() => {
        const wrapper = document.getElementById(`trustee-search-modal-${sampleOrder.id}-wrapper`);
        expect(wrapper).toHaveClass('is-visible');
      });
    });

    // Integration test: exercises full search-to-approval flow
    test('confirming a search result calls approval API and shows success', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      setupSearchMocks();
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });

      await searchAndSelectTrustee();

      await waitFor(() => {
        expect(Api2.patchTrusteeVerificationOrderApproval).toHaveBeenCalledWith(
          sampleOrder.id,
          'manual-trustee-1',
          'Manual Match',
        );
        expect(onOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ type: UswdsAlertStyle.Success }),
          expect.objectContaining({
            status: 'approved',
            resolvedTrusteeId: 'manual-trustee-1',
            resolvedTrusteeName: 'Manual Match',
          }),
        );
      });
    });

    // Integration test: exercises full search-to-approval error flow
    test('manual search approval failure calls onOrderUpdate with error', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockRejectedValue(
        new Error('Network error'),
      );
      setupSearchMocks();
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });

      await searchAndSelectTrustee();

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ type: UswdsAlertStyle.Error }),
          sampleOrder,
        );
      });
    });
  });

  describe('"Not Provided" for missing contact fields', () => {
    test('shows "Not Provided" for phone and email when DXTR trustee has no legacy contact info', () => {
      renderWithProps({
        order: { ...sampleOrder, dxtrTrustee: { fullName: 'John Doe' } },
      });

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      const matches = content.textContent?.match(/Not Provided/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    test('shows "Not Provided" for phone and email when candidate has no contact info', async () => {
      const noContactCandidate: CandidateScore = {
        trusteeId: 'trustee-no-contact',
        trusteeName: 'No Contact',
        totalScore: 80,
        addressScore: 80,
        districtDivisionScore: 80,
        chapterScore: 80,
      };
      const orderWithCandidate: TrusteeMatchVerificationListItem = {
        ...sampleOrder,
        preselectedCandidate: { trusteeId: 'trustee-no-contact', trusteeName: 'No Contact' },
        candidateCount: 1,
      };
      const detailWithCandidate: TrusteeMatchVerification = {
        ...sampleOrderDetail,
        matchCandidates: [noContactCandidate],
      };
      renderWithProps({ order: orderWithCandidate });
      await mockDetailAndExpand(detailWithCandidate);

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      const matches = content.textContent?.match(/Not Provided/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('"Not Provided" for missing address', () => {
    test('shows "Not Provided" in address cell when DXTR trustee has no legacy address', () => {
      renderWithProps({
        order: { ...sampleOrder, dxtrTrustee: { fullName: 'John Doe' } },
      });

      const addressCell = screen
        .getByTestId(`accordion-content-${sampleOrder.id}`)
        .querySelector('[data-cell="Address"]');
      expect(addressCell?.textContent).toBe('Not Provided');
    });

    test('shows "Not Provided" in address cell when candidate has no address', async () => {
      const noAddrCandidate: CandidateScore = {
        trusteeId: 'trustee-no-addr',
        trusteeName: 'No Address',
        totalScore: 80,
        addressScore: 80,
        districtDivisionScore: 80,
        chapterScore: 80,
      };
      const orderWithCandidate: TrusteeMatchVerificationListItem = {
        ...sampleOrder,
        preselectedCandidate: { trusteeId: 'trustee-no-addr', trusteeName: 'No Address' },
        candidateCount: 1,
      };
      const detailWithCandidate: TrusteeMatchVerification = {
        ...sampleOrderDetail,
        matchCandidates: [noAddrCandidate],
      };
      renderWithProps({ order: orderWithCandidate });
      await mockDetailAndExpand(detailWithCandidate);

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      const addressCells = content.querySelectorAll('[data-cell="Address"]');
      const candidateAddressCell = Array.from(addressCells).find(
        (el) => el.textContent === 'Not Provided',
      );
      expect(candidateAddressCell).toBeInTheDocument();
    });
  });

  describe('reject flow via rejection modal', () => {
    function submitRejectionModal(orderId: string, reason: string) {
      const textarea = screen.getByTestId(`rejection-reason-input-${orderId}`);
      fireEvent.change(textarea, { target: { value: reason } });
      const submitButton = document.getElementById(
        `trustee-rejection-modal-${orderId}-submit-button`,
      );
      fireEvent.click(submitButton!);
    }

    test('calls rejection API and onOrderUpdate with warning on reject success', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderRejection').mockResolvedValue(undefined);
      const onOrderUpdate = vi.fn();
      renderWithProps({ order: sampleOrderWithCandidates, onOrderUpdate });

      submitRejectionModal(sampleOrderWithCandidates.id, 'Wrong person');

      await waitFor(() => {
        expect(Api2.patchTrusteeVerificationOrderRejection).toHaveBeenCalledWith(
          sampleOrderWithCandidates.id,
          'Wrong person',
        );
        expect(onOrderUpdate).toHaveBeenCalledWith(
          { message: 'Trustee match rejected.', type: UswdsAlertStyle.Warning, timeOut: 8 },
          expect.objectContaining({ status: 'rejected', reason: 'Wrong person' }),
        );
      });
    });

    test('calls onOrderUpdate with error alert on reject failure', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderRejection').mockRejectedValue(
        new Error('Network error'),
      );
      const onOrderUpdate = vi.fn();
      renderWithProps({ order: sampleOrderWithCandidates, onOrderUpdate });

      submitRejectionModal(sampleOrderWithCandidates.id, 'Wrong person');

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          { message: 'Failed to reject trustee match.', type: UswdsAlertStyle.Error, timeOut: 8 },
          sampleOrderWithCandidates,
        );
      });
    });
  });

  describe('Other Potential Matches pagination', () => {
    function makeMultipleMatchOrder(
      totalCandidates: number,
    ): [TrusteeMatchVerificationListItem, TrusteeMatchVerification] {
      const candidates: CandidateScore[] = Array.from({ length: totalCandidates }, (_, i) => ({
        trusteeId: `trustee-${i + 1}`,
        trusteeName: `Candidate ${i + 1}`,
        totalScore: 100 - i,
        addressScore: 90,
        districtDivisionScore: 90,
        chapterScore: 90,
      }));
      // Use preselectedCandidate: null so the initial render does not attempt to render
      // candidate rows before enrichedOrder is loaded (avoids crash on undefined candidatesToShow[0]).
      // After expand, the component derives preselected from enrichedOrder.matchCandidates.
      const listItem: TrusteeMatchVerificationListItem = {
        ...sampleOrder,
        mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
        preselectedCandidate: null,
        candidateCount: totalCandidates,
      };
      const detail: TrusteeMatchVerification = {
        ...sampleOrderDetail,
        mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
        matchCandidates: candidates,
      };
      return [listItem, detail];
    }

    test('does not show pagination when other matches are 5 or fewer', async () => {
      const [listItem, detail] = makeMultipleMatchOrder(6); // 1 strongest + 5 others
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      expect(screen.queryByTestId('pagination-button-other-matches-next')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('pagination-button-other-matches-previous'),
      ).not.toBeInTheDocument();
    });

    test('shows pagination when other matches exceed 5', async () => {
      const [listItem, detail] = makeMultipleMatchOrder(7); // 1 strongest + 6 others
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      expect(screen.getByTestId('pagination-button-other-matches-next')).toBeInTheDocument();
    });

    test('page 1 shows first 5 other matches and not the 6th', async () => {
      const [listItem, detail] = makeMultipleMatchOrder(7);
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).toContain('Candidate 2'); // first other match
      expect(content.textContent).toContain('Candidate 6'); // 5th other match
      expect(content.textContent).not.toContain('Candidate 7'); // 6th other match (page 2)
    });

    test('clicking next shows the next page of other matches', async () => {
      const [listItem, detail] = makeMultipleMatchOrder(7);
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).toContain('Candidate 7');
      expect(content.textContent).not.toContain('Candidate 2');
    });

    test('previous button is not shown on the first page', async () => {
      const [listItem, detail] = makeMultipleMatchOrder(7);
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      expect(
        screen.queryByTestId('pagination-button-other-matches-previous'),
      ).not.toBeInTheDocument();
    });

    test('next button is not shown on the last page', async () => {
      const [listItem, detail] = makeMultipleMatchOrder(7);
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));

      expect(screen.queryByTestId('pagination-button-other-matches-next')).not.toBeInTheDocument();
    });

    test('clicking a page number navigates to that page', async () => {
      const [listItem, detail] = makeMultipleMatchOrder(12); // 1 strongest + 11 others = 3 pages
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      fireEvent.click(screen.getByTestId('pagination-button-other-matches-page-3'));

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).toContain('Candidate 12'); // last candidate on page 3
      expect(content.textContent).not.toContain('Candidate 2');
    });

    test('shows ellipsis before last pages when current page is near the end', async () => {
      // N=37: 1 strongest + 36 others, totalPages=8; page 5 triggers the right-tail branch
      const [listItem, detail] = makeMultipleMatchOrder(37);
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      // Navigate to page 5 (near the end, triggers last-pages branch)
      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));
      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));
      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));
      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));

      // Page 5 of 8 is in the right-tail branch: pages = [1, '...', 4, 5, 6, 7, 8]
      expect(screen.getByTestId('pagination-button-other-matches-page-8')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-button-other-matches-page-1')).toBeInTheDocument();
      expect(
        screen.queryByTestId('pagination-button-other-matches-page-2'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('pagination-button-other-matches-page-3'),
      ).not.toBeInTheDocument();
    });

    test('shows ellipsis on both sides when current page is in the middle', async () => {
      // N=51: 1 strongest + 50 others, totalPages=10; pages 5-6 trigger the middle-window branch
      const [listItem, detail] = makeMultipleMatchOrder(51);
      renderWithProps({ order: listItem });
      await mockDetailAndExpand(detail);

      // Navigate to page 5
      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));
      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));
      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));
      fireEvent.click(screen.getByTestId('pagination-button-other-matches-next'));

      // Middle-window branch: pages = [1, '...', 4, 5, 6, '...', 10]
      expect(screen.getByTestId('pagination-button-other-matches-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-button-other-matches-page-4')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-button-other-matches-page-5')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-button-other-matches-page-6')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-button-other-matches-page-10')).toBeInTheDocument();
      expect(
        screen.queryByTestId('pagination-button-other-matches-page-2'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('pagination-button-other-matches-page-3'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('pagination-button-other-matches-page-7'),
      ).not.toBeInTheDocument();
    });
  });

  describe('heading structure', () => {
    test('no-candidates view shows no CAMS heading above search link', () => {
      renderWithProps();

      expect(
        screen.queryByRole('heading', { name: /CAMS Strongest Match/, hidden: true }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /CAMS Suggested Matches/, hidden: true }),
      ).not.toBeInTheDocument();
    });

    test('single-match view shows "CAMS Strongest Match" but no sub-headings', async () => {
      renderWithProps({ order: sampleOrderWithCandidates });
      await mockDetailAndExpand(sampleOrderWithCandidatesDetail);

      expect(
        screen.getByRole('heading', { name: 'CAMS Strongest Match', hidden: true }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Other Potential Matches', hidden: true }),
      ).not.toBeInTheDocument();
    });

    test('multiple-match view shows "CAMS Strongest Match" and "Other Potential Matches" headings', async () => {
      const multipleCandidates: CandidateScore[] = [
        {
          trusteeId: 'trustee-high',
          trusteeName: 'High Score',
          totalScore: 90,
          addressScore: 90,
          districtDivisionScore: 90,
          chapterScore: 90,
        },
        {
          trusteeId: 'trustee-low',
          trusteeName: 'Low Score',
          totalScore: 70,
          addressScore: 70,
          districtDivisionScore: 70,
          chapterScore: 70,
        },
      ];
      // preselectedCandidate: null avoids crash on initial render (pre-expand candidatesToShow[0] is undefined)
      const multipleMatchOrder: TrusteeMatchVerificationListItem = {
        ...sampleOrder,
        mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
        preselectedCandidate: null,
        candidateCount: 2,
      };
      const multipleMatchDetail: TrusteeMatchVerification = {
        ...sampleOrderDetail,
        mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
        matchCandidates: multipleCandidates,
      };
      renderWithProps({ order: multipleMatchOrder });
      await mockDetailAndExpand(multipleMatchDetail);

      expect(
        screen.queryByRole('heading', { name: 'CAMS Suggested Matches', hidden: true }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'CAMS Strongest Match', hidden: true }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Other Potential Matches', hidden: true }),
      ).toBeInTheDocument();
      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).toContain('High Score');
    });
  });

  describe('PERFECT_MATCH_INACTIVE_STATUS rendering', () => {
    const inactiveCandidates: CandidateScore[] = [
      {
        trusteeId: 'trustee-1',
        trusteeName: 'Jane Smith',
        totalScore: 100,
        addressScore: 100,
        districtDivisionScore: 100,
        chapterScore: 100,
        appointments: [
          MockData.getTrusteeAppointment({
            courtName: 'Southern District',
            courtDivisionName: 'Manhattan',
            status: 'voluntarily-suspended',
          }),
        ],
      },
    ];

    const inactiveOrder: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
      inactiveAppointmentStatus: 'voluntarily-suspended',
      preselectedCandidate: { trusteeId: 'trustee-1', trusteeName: 'Jane Smith' },
      candidateCount: 1,
    };

    const inactiveDetail: TrusteeMatchVerification = {
      ...sampleOrderDetail,
      mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
      inactiveAppointmentStatus: 'voluntarily-suspended',
      matchCandidates: inactiveCandidates,
    };

    test('should render "Inactive trustee" as task type label for inactive match', () => {
      renderWithProps({ order: inactiveOrder });

      const heading = screen.getByTestId(`accordion-heading-${inactiveOrder.id}`);
      expect(heading.textContent).toContain('Inactive trustee');
      expect(heading.textContent).not.toContain('Trustee Mismatch');
    });

    test('should render distinct problem statement for inactive match', async () => {
      renderWithProps({ order: inactiveOrder });
      await mockDetailAndExpand(inactiveDetail);

      const content = screen.getByTestId(`accordion-content-${inactiveOrder.id}`);
      expect(content.textContent).toContain(
        'Trustee is inactive in CAMS but was appointed to case',
      );
      expect(content.textContent).not.toContain(
        'Trustee sent from the court does not match a CAMS Trustee',
      );
    });

    test('should still render original problem statement for other mismatch types', async () => {
      const highConfidenceOrder: TrusteeMatchVerificationListItem = {
        ...sampleOrderWithCandidates,
        mismatchReason: 'HIGH_CONFIDENCE_MATCH',
      };
      const highConfidenceDetail: TrusteeMatchVerification = {
        ...sampleOrderWithCandidatesDetail,
        mismatchReason: 'HIGH_CONFIDENCE_MATCH',
      };
      renderWithProps({ order: highConfidenceOrder });
      await mockDetailAndExpand(highConfidenceDetail);

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).toContain(
        'Trustee sent from the court does not match a CAMS Trustee',
      );
      expect(content.textContent).not.toContain('inactive');
    });

    test('should render "Trustee Mismatch" as task type label for non-inactive mismatch types', () => {
      renderWithProps({
        order: { ...sampleOrderWithCandidates, mismatchReason: 'HIGH_CONFIDENCE_MATCH' },
      });

      const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
      expect(heading.textContent).toContain('Trustee Mismatch');
      expect(heading.textContent).not.toContain('Inactive trustee');
    });
  });

  describe('MULTIPLE_TRUSTEES_MATCH rendering', () => {
    const multipleCandidates: CandidateScore[] = [
      {
        trusteeId: 'trustee-low',
        trusteeName: 'Low Score Trustee',
        totalScore: 50,
        addressScore: 40,
        districtDivisionScore: 60,
        chapterScore: 50,
        address: {
          address1: '789 Pine St',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          countryCode: 'US',
        },
        phone: { number: '555-3333' },
        email: 'low@example.com',
        appointments: [
          MockData.getTrusteeAppointment({
            courtName: 'Northern District',
            courtDivisionName: 'Chicago',
          }),
        ],
      },
      {
        trusteeId: 'trustee-high',
        trusteeName: 'High Score Trustee',
        totalScore: 72,
        addressScore: 60,
        districtDivisionScore: 100,
        chapterScore: 50,
        address: {
          address1: '456 Oak Ave',
          city: 'Boston',
          state: 'MA',
          zipCode: '02101',
          countryCode: 'US',
        },
        phone: { number: '555-2222', extension: '42' },
        email: 'high@example.com',
        appointments: [
          MockData.getTrusteeAppointment({
            courtName: 'District of Massachusetts',
            courtDivisionName: 'Boston',
          }),
        ],
      },
      {
        trusteeId: 'trustee-mid',
        trusteeName: 'Mid Score Trustee',
        totalScore: 65,
        addressScore: 70,
        districtDivisionScore: 50,
        chapterScore: 80,
      },
    ];

    // preselectedCandidate: null avoids a crash on initial render (before enrichedOrder loads)
    // because the component uses candidatesToShow[0] which is undefined pre-expand for multiple match.
    const multipleCandidatesOrder: TrusteeMatchVerificationListItem = {
      ...sampleOrder,
      mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
      preselectedCandidate: null,
      candidateCount: 3,
    };

    const multipleCandidatesDetail: TrusteeMatchVerification = {
      ...sampleOrderDetail,
      mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
      matchCandidates: multipleCandidates,
    };

    test('renders all 3 candidates for MULTIPLE_TRUSTEES_MATCH pending order', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      expect(screen.getByTestId('candidate-name-trustee-low')).toBeInTheDocument();
      expect(screen.getByTestId('candidate-name-trustee-high')).toBeInTheDocument();
      expect(screen.getByTestId('candidate-name-trustee-mid')).toBeInTheDocument();
    });

    test('displays candidates sorted by totalScore descending (highest first)', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      const candidateSection = screen.getByTestId('candidate-info');
      const names = candidateSection.querySelectorAll('[data-cell="Name"]');
      expect(names[0].textContent).toContain('High Score Trustee');
      expect(names[1].textContent).toContain('Mid Score Trustee');
      expect(names[2].textContent).toContain('Low Score Trustee');
    });

    test('does not show score breakdown for candidates', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      expect(screen.queryByTestId('candidate-scores-trustee-high')).not.toBeInTheDocument();
      expect(screen.queryByTestId('candidate-scores-trustee-mid')).not.toBeInTheDocument();
      expect(screen.queryByTestId('candidate-scores-trustee-low')).not.toBeInTheDocument();
    });

    test('shows description text and candidate count', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).toContain('Results are ordered from strongest to weakest match');
      expect(screen.getByTestId('other-matches-count').textContent).toBe('2 matches');
    });

    test('shows "search here" inline link in description', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      const searchButton = screen.getByRole('button', {
        name: /search here/,
        hidden: true,
      });
      expect(searchButton).toBeInTheDocument();
    });

    test('shows "Multiple Match" as task type in accordion heading', () => {
      renderWithProps({ order: multipleCandidatesOrder });

      const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
      expect(heading.textContent).toContain('Multiple Match');
      expect(heading.textContent).not.toContain('Trustee Mismatch');
    });

    test('shows both "CAMS Strongest Match" and "Other Potential Matches" headings', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).toContain('CAMS Strongest Match');
      expect(content.textContent).toContain('Other Potential Matches');
    });

    test('renders per-row "Match Trustee" action buttons (no radio buttons)', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      expect(screen.queryAllByRole('radio', { hidden: true })).toHaveLength(0);
      expect(screen.queryByTestId('approve-selected-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('approve-candidate-trustee-high')).toBeInTheDocument();
      expect(screen.getByTestId('approve-candidate-trustee-mid')).toBeInTheDocument();
      expect(screen.getByTestId('approve-candidate-trustee-low')).toBeInTheDocument();
    });

    test('clicking per-row "Match Trustee" opens confirmation modal for that candidate', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-high'));

      await waitFor(() => {
        const modalSubmit = document.getElementById(
          `trustee-confirmation-modal-${multipleCandidatesOrder.id}-submit-button`,
        );
        expect(modalSubmit).toBeInTheDocument();
      });
    });

    test('approval flow calls API with clicked candidate trustee ID and name', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      const onOrderUpdate = vi.fn();
      renderWithProps({ order: multipleCandidatesOrder, onOrderUpdate });
      await mockDetailAndExpand(multipleCandidatesDetail);

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-high'));

      const modalSubmit = document.getElementById(
        `trustee-confirmation-modal-${multipleCandidatesOrder.id}-submit-button`,
      );
      fireEvent.click(modalSubmit!);

      await waitFor(() => {
        expect(Api2.patchTrusteeVerificationOrderApproval).toHaveBeenCalledWith(
          multipleCandidatesOrder.id,
          'trustee-high',
          'High Score Trustee',
        );
        expect(onOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ type: UswdsAlertStyle.Success }),
          expect.objectContaining({
            status: 'approved',
            resolvedTrusteeId: 'trustee-high',
            resolvedTrusteeName: 'High Score Trustee',
          }),
        );
      });
    });

    test('reject button is not rendered for multiple match order', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    });

    test('"search here" inline link opens search modal', async () => {
      renderWithProps({ order: multipleCandidatesOrder });
      await mockDetailAndExpand(multipleCandidatesDetail);

      const searchButton = screen.getByRole('button', {
        name: /search here/,
        hidden: true,
      });
      fireEvent.click(searchButton);

      await waitFor(() => {
        const wrapper = document.getElementById(
          `trustee-search-modal-${multipleCandidatesOrder.id}-wrapper`,
        );
        expect(wrapper).toHaveClass('is-visible');
      });
    });

    test('readonly mode for rejected MULTIPLE_TRUSTEES_MATCH shows all candidates without radio buttons', async () => {
      const rejectedMultipleOrder: TrusteeMatchVerificationListItem = {
        ...multipleCandidatesOrder,
        status: 'rejected',
      };
      const rejectedMultipleDetail: TrusteeMatchVerification = {
        ...multipleCandidatesDetail,
        status: 'rejected',
      };
      renderWithProps({ order: rejectedMultipleOrder });
      await mockDetailAndExpand(rejectedMultipleDetail);

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).toContain('High Score Trustee');
      expect(content.textContent).toContain('Mid Score Trustee');
      expect(content.textContent).toContain('Low Score Trustee');
      expect(screen.queryAllByRole('radio', { hidden: true })).toHaveLength(0);
      expect(screen.queryByTestId('approve-selected-button')).not.toBeInTheDocument();
    });

    test('does not show score breakdown in readonly mode for rejected MULTIPLE_TRUSTEES_MATCH', async () => {
      const rejectedMultipleOrder: TrusteeMatchVerificationListItem = {
        ...multipleCandidatesOrder,
        status: 'rejected',
      };
      const rejectedMultipleDetail: TrusteeMatchVerification = {
        ...multipleCandidatesDetail,
        status: 'rejected',
      };
      renderWithProps({ order: rejectedMultipleOrder });
      await mockDetailAndExpand(rejectedMultipleDetail);

      expect(screen.queryByTestId('candidate-scores-trustee-high')).not.toBeInTheDocument();
      expect(screen.queryByTestId('candidate-scores-trustee-mid')).not.toBeInTheDocument();
      expect(screen.queryByTestId('candidate-scores-trustee-low')).not.toBeInTheDocument();
    });

    test('HIGH_CONFIDENCE_MATCH still renders single pre-selected candidate (regression check)', async () => {
      const highConfidenceOrder: TrusteeMatchVerificationListItem = {
        ...sampleOrder,
        mismatchReason: 'HIGH_CONFIDENCE_MATCH',
        preselectedCandidate: { trusteeId: 'trustee-1', trusteeName: 'Jane Smith' },
        candidateCount: 1,
      };
      const highConfidenceDetail: TrusteeMatchVerification = {
        ...sampleOrderDetail,
        mismatchReason: 'HIGH_CONFIDENCE_MATCH',
        matchCandidates: [
          {
            trusteeId: 'trustee-1',
            trusteeName: 'Jane Smith',
            totalScore: 95,
            addressScore: 90,
            districtDivisionScore: 100,
            chapterScore: 95,
          },
        ],
      };
      renderWithProps({ order: highConfidenceOrder });
      await mockDetailAndExpand(highConfidenceDetail);

      expect(screen.getByTestId('candidate-info')).toBeInTheDocument();
      expect(screen.queryByTestId('multiple-candidates-info')).not.toBeInTheDocument();
      expect(screen.getByTestId('approve-candidate-trustee-1')).toBeInTheDocument();
      expect(screen.queryAllByRole('radio', { hidden: true })).toHaveLength(0);
    });

    test('NO_TRUSTEE_MATCH still renders no-candidates view (regression check)', () => {
      renderWithProps({
        order: {
          ...sampleOrder,
          mismatchReason: 'NO_TRUSTEE_MATCH',
          preselectedCandidate: null,
          candidateCount: 0,
        },
      });

      expect(screen.queryByTestId('multiple-candidates-info')).not.toBeInTheDocument();
      expect(screen.queryByTestId('candidate-info')).not.toBeInTheDocument();
      const searchButton = screen.getByRole('button', {
        name: /Search for a trustee/,
        hidden: true,
      });
      expect(searchButton).toBeInTheDocument();
    });
  });
});
