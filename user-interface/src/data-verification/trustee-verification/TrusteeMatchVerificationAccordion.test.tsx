import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  TrusteeMatchVerificationAccordion,
  TrusteeMatchVerificationAccordionProps,
} from './TrusteeMatchVerificationAccordion';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import MockData from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

const fieldHeaders = ['Court District', 'Order Filed', 'Task Type', 'Task Status'];

const sampleOrder: TrusteeMatchVerification = {
  id: 'case-001:john doe',
  documentType: 'TRUSTEE_MATCH_VERIFICATION',
  orderType: 'trustee-match',
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
};

const sampleOrderWithCandidates: TrusteeMatchVerification = {
  ...sampleOrder,
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

function renderWithProps(props: Partial<TrusteeMatchVerificationAccordionProps> = {}) {
  const defaultProps: TrusteeMatchVerificationAccordionProps = {
    order: sampleOrder,
    orderType,
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

describe('TrusteeMatchVerificationAccordion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

    const noMatchLink = screen.getByRole('link', { name: /Search for a trustee/, hidden: true });
    expect(noMatchLink).toBeInTheDocument();
    expect(noMatchLink.closest('.search-link-container')).toHaveTextContent(
      'There are no suggested matches in CAMS.',
    );
  });

  test('should render candidate-info section with Confirm Match button for pending order', () => {
    renderWithProps({ order: sampleOrderWithCandidates });

    const candidateInfo = screen.getByTestId('candidate-info');
    expect(candidateInfo).toBeInTheDocument();
    expect(screen.getByTestId('candidate-name-trustee-1').textContent).toContain('Jane Smith');
    expect(screen.getByTestId('approve-candidate-trustee-1')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Search for a trustee/, hidden: true }),
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

    fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
    const modalSubmit = document.getElementById(
      `trustee-confirmation-modal-${sampleOrderWithCandidates.id}-submit-button`,
    );
    fireEvent.click(modalSubmit!);

    await waitFor(() => {
      expect(Api2.patchTrusteeVerificationOrderApproval).toHaveBeenCalledWith(
        sampleOrderWithCandidates.id,
        'trustee-1',
      );
    });
  });

  test('calls onOrderUpdate with success alert and updated order on approve success', async () => {
    vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
    const onOrderUpdate = vi.fn();
    renderWithProps({ order: sampleOrderWithCandidates, onOrderUpdate });

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
        { ...sampleOrderWithCandidates, status: 'approved', resolvedTrusteeId: 'trustee-1' },
      );
    });
  });

  test('calls onOrderUpdate with error alert on approve failure', async () => {
    vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockRejectedValue(
      new Error('Network error'),
    );
    const onOrderUpdate = vi.fn();
    renderWithProps({ order: sampleOrderWithCandidates, onOrderUpdate });

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

  test('should render search link with no-other-matches message for readonly order with candidate', () => {
    renderWithProps({
      order: {
        ...sampleOrderWithCandidates,
        status: 'rejected',
        resolvedTrusteeId: undefined,
      },
    });

    const link = screen.getByRole('link', {
      name: /Search for a different trustee\./,
      hidden: true,
    });
    expect(link).toBeInTheDocument();
    expect(link.closest('.search-link-container')).toHaveTextContent(
      'There are no other suggested matches in CAMS.',
    );
  });

  test('should render "Search for a different trustee." link when match candidates exist', () => {
    renderWithProps({
      order: {
        ...sampleOrder,
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
      },
    });

    const link = screen.getByRole('link', { name: /Search for a different trustee/, hidden: true });
    expect(link).toBeInTheDocument();
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

  test('should render DXTR trustee legacy address with line breaks between multiple lines', () => {
    const orderWithAddress: TrusteeMatchVerification = {
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

  test('should render match candidate with full address, phone extension, and multiple appointments', () => {
    renderWithProps({
      order: {
        ...sampleOrder,
        matchCandidates: [
          {
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
          },
        ],
      },
    });

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('456 Oak Ave');
    expect(content.textContent).toContain('Boston, MA 02101');
    expect(content.textContent).toContain('555-5678 x123');
    expect(content.textContent).toContain('Southern District');
    expect(content.textContent).toContain('Eastern District');
  });

  test('should render read-only candidate table for rejected order, selecting highest-scoring candidate', () => {
    renderWithProps({
      order: {
        ...sampleOrder,
        status: 'rejected',
        matchCandidates: [
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
        ],
      },
    });

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

  test('should render Branch B with empty phone, email, and no appointments when candidate has no enrichment', () => {
    renderWithProps({
      order: {
        ...sampleOrder,
        status: 'rejected',
        matchCandidates: [
          {
            trusteeId: 'trustee-bare',
            trusteeName: 'Bare Candidate',
            totalScore: 80,
            addressScore: 80,
            districtDivisionScore: 80,
            chapterScore: 80,
          },
        ],
      },
    });

    expect(screen.queryByTestId('approve-candidate-trustee-1')).not.toBeInTheDocument();
    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('Bare Candidate');
  });

  test('should use updatedOn as date fallback when createdOn is absent, and render phone without extension in Branch B', () => {
    const { createdOn: _omit, ...orderWithoutCreatedOn } = sampleOrder;
    renderWithProps({
      order: {
        ...orderWithoutCreatedOn,
        status: 'rejected',
        matchCandidates: [
          {
            trusteeId: 'trustee-1',
            trusteeName: 'No Extension',
            totalScore: 80,
            addressScore: 80,
            districtDivisionScore: 80,
            chapterScore: 80,
            phone: { number: '555-7777' },
          },
        ],
      },
    });

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('01/15/2026');

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('555-7777');
    expect(content.textContent).not.toContain(' x');
  });

  test('should render match candidate phone without extension', () => {
    renderWithProps({
      order: {
        ...sampleOrder,
        matchCandidates: [
          {
            trusteeId: 'trustee-2',
            trusteeName: 'Bob Johnson',
            totalScore: 80,
            addressScore: 75,
            districtDivisionScore: 90,
            chapterScore: 80,
            phone: { number: '555-9999' },
          },
        ],
      },
    });

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('555-9999');
    expect(content.textContent).not.toContain('x555');
  });

  describe('Slice 3 — reject flow', () => {
    test('renders reject-button alongside approve-button for pending order with candidate', () => {
      renderWithProps({ order: sampleOrderWithCandidates });

      expect(screen.getByTestId('approve-candidate-trustee-1')).toBeInTheDocument();
      expect(screen.getByTestId('reject-button')).toBeInTheDocument();
    });

    test('reject-button does not appear for non-pending orders (Branch B)', () => {
      renderWithProps({ order: { ...sampleOrderWithCandidates, status: 'rejected' } });

      expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    });

    test('clicking reject-button opens the rejection modal', async () => {
      renderWithProps({ order: sampleOrderWithCandidates });

      fireEvent.click(screen.getByTestId('reject-button'));

      await waitFor(() => {
        expect(
          document.getElementById(
            `trustee-rejection-modal-${sampleOrderWithCandidates.id}-submit-button`,
          ),
        ).toBeInTheDocument();
      });
    });

    test('submitting reject with a reason calls patchTrusteeVerificationOrderRejection with reason', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderRejection').mockResolvedValue(undefined);
      renderWithProps({ order: sampleOrderWithCandidates });

      fireEvent.click(screen.getByTestId('reject-button'));
      fireEvent.change(
        screen.getByTestId(`rejection-reason-input-${sampleOrderWithCandidates.id}`),
        { target: { value: 'Not the right person' } },
      );
      const modalSubmit = document.getElementById(
        `trustee-rejection-modal-${sampleOrderWithCandidates.id}-submit-button`,
      );
      fireEvent.click(modalSubmit!);

      await waitFor(() => {
        expect(Api2.patchTrusteeVerificationOrderRejection).toHaveBeenCalledWith(
          sampleOrderWithCandidates.id,
          'Not the right person',
        );
      });
    });

    test('on reject success calls onOrderUpdate with Warning alert and rejected status', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderRejection').mockResolvedValue(undefined);
      const onOrderUpdate = vi.fn();
      renderWithProps({ order: sampleOrderWithCandidates, onOrderUpdate });

      fireEvent.click(screen.getByTestId('reject-button'));
      fireEvent.change(
        screen.getByTestId(`rejection-reason-input-${sampleOrderWithCandidates.id}`),
        { target: { value: 'Reject reason' } },
      );
      const modalSubmit = document.getElementById(
        `trustee-rejection-modal-${sampleOrderWithCandidates.id}-submit-button`,
      );
      fireEvent.click(modalSubmit!);

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          { message: 'Trustee match rejected.', type: UswdsAlertStyle.Warning, timeOut: 8 },
          expect.objectContaining({ status: 'rejected' }),
        );
      });
    });

    test('on reject failure calls onOrderUpdate with error alert and original order', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderRejection').mockRejectedValue(
        new Error('Network error'),
      );
      const onOrderUpdate = vi.fn();
      renderWithProps({ order: sampleOrderWithCandidates, onOrderUpdate });

      fireEvent.click(screen.getByTestId('reject-button'));
      fireEvent.change(
        screen.getByTestId(`rejection-reason-input-${sampleOrderWithCandidates.id}`),
        { target: { value: 'Reject reason' } },
      );
      const modalSubmit = document.getElementById(
        `trustee-rejection-modal-${sampleOrderWithCandidates.id}-submit-button`,
      );
      fireEvent.click(modalSubmit!);

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          { message: 'Failed to reject trustee match.', type: UswdsAlertStyle.Error, timeOut: 8 },
          sampleOrderWithCandidates,
        );
      });
    });
  });

  describe('PERFECT_MATCH_INACTIVE_STATUS rendering', () => {
    const inactiveOrder: TrusteeMatchVerification = {
      ...sampleOrder,
      mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
      inactiveAppointmentStatus: 'voluntarily-suspended',
      matchCandidates: [
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
      ],
    };

    test('should render "Inactive trustee" as task type label for inactive match', () => {
      renderWithProps({ order: inactiveOrder });

      const heading = screen.getByTestId(`accordion-heading-${inactiveOrder.id}`);
      expect(heading.textContent).toContain('Inactive trustee');
      expect(heading.textContent).not.toContain('Trustee Mismatch');
    });

    test('should render distinct problem statement for inactive match', () => {
      renderWithProps({ order: inactiveOrder });

      const content = screen.getByTestId(`accordion-content-${inactiveOrder.id}`);
      expect(content.textContent).toContain(
        'Trustee is inactive in CAMS but was appointed to case',
      );
      expect(content.textContent).not.toContain(
        'Trustee sent from the court does not match a CAMS Trustee',
      );
    });

    test('should still render original problem statement for other mismatch types', () => {
      renderWithProps({
        order: { ...sampleOrderWithCandidates, mismatchReason: 'HIGH_CONFIDENCE_MATCH' },
      });

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
});
