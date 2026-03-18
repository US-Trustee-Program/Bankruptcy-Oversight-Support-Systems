import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  TrusteeMatchVerificationAccordion,
  TrusteeMatchVerificationAccordionProps,
} from './TrusteeMatchVerificationAccordion';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import MockData from '@common/cams/test-utilities/mock-data';

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
          courtDivisionCode: '',
          courtDivisionName: '',
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

    const link = screen.getByRole('link', { name: '22-11111', hidden: true });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', `/case-detail/${sampleOrder.caseId}`);

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('John Doe');

    const noMatchLink = screen.getByRole('link', { name: /Search for a trustee/, hidden: true });
    expect(noMatchLink).toBeInTheDocument();
    expect(noMatchLink.closest('p')).toHaveTextContent('There are no suggested matches in CAMS.');
  });

  test('should render candidate-info section with Confirm Match button for pending order', () => {
    renderWithProps({ order: sampleOrderWithCandidates });

    const candidateInfo = screen.getByTestId('candidate-info');
    expect(candidateInfo).toBeInTheDocument();
    expect(screen.getByTestId('candidate-name').textContent).toContain('Jane Smith');
    expect(screen.getByTestId('approve-button')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Search for a trustee/, hidden: true }),
    ).not.toBeInTheDocument();
  });

  test('should NOT render candidate-info section for approved order', () => {
    renderWithProps({ order: { ...sampleOrderWithCandidates, status: 'approved' } });

    expect(screen.queryByTestId('candidate-info')).not.toBeInTheDocument();
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
});
