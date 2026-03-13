import { render, screen } from '@testing-library/react';
import { TrusteeMatchVerificationAccordion } from './TrusteeMatchVerificationAccordion';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { orderType, orderStatusType } from '@/lib/utils/labels';

const fieldHeaders = ['Court District', 'Order Filed', 'Event Type', 'Event Status'];

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

describe('TrusteeMatchVerificationAccordion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render court ID and event type label', () => {
    render(
      <TrusteeMatchVerificationAccordion
        order={sampleOrder}
        orderType={orderType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
      />,
    );

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain(sampleOrder.courtId);
    expect(heading.textContent).toContain('Trustee Match Verification');
  });

  test('should render "Pending Review" status for pending order', () => {
    render(
      <TrusteeMatchVerificationAccordion
        order={sampleOrder}
        orderType={orderType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
      />,
    );

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('Pending Review');
  });

  test('should render "Verified" status for approved order', () => {
    render(
      <TrusteeMatchVerificationAccordion
        order={{ ...sampleOrder, status: 'approved' }}
        orderType={orderType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
      />,
    );

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('Verified');
  });

  test('should render "Rejected" status for rejected order', () => {
    render(
      <TrusteeMatchVerificationAccordion
        order={{ ...sampleOrder, status: 'rejected' }}
        orderType={orderType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
      />,
    );

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('Rejected');
  });

  test('should not be visible when hidden is true', () => {
    render(
      <TrusteeMatchVerificationAccordion
        order={sampleOrder}
        orderType={orderType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
        hidden={true}
      />,
    );

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading).not.toBeVisible();
  });
});
