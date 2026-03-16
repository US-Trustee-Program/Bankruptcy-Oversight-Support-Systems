import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TrusteeMatchVerificationAccordion } from './TrusteeMatchVerificationAccordion';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { orderType, orderStatusType } from '@/lib/utils/labels';

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

function renderComponent(order = sampleOrder, hidden = false) {
  return render(
    <BrowserRouter>
      <TrusteeMatchVerificationAccordion
        order={order}
        orderType={orderType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
        hidden={hidden}
      />
    </BrowserRouter>,
  );
}

describe('TrusteeMatchVerificationAccordion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render court ID and task type label', () => {
    renderComponent();

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain(sampleOrder.courtId);
    expect(heading.textContent).toContain('Trustee Mismatch');
  });

  test('should render court name when courts prop is provided', () => {
    render(
      <BrowserRouter>
        <TrusteeMatchVerificationAccordion
          order={sampleOrder}
          orderType={orderType}
          statusType={orderStatusType}
          fieldHeaders={fieldHeaders}
          courts={[
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
          ]}
        />
      </BrowserRouter>,
    );

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('Southern District of New York');
  });

  test('should render the event date in the header', () => {
    renderComponent();

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('01/15/2026');
  });

  test('should render case link in content', () => {
    renderComponent();

    const link = screen.getByRole('link', { name: '22-11111', hidden: true });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', `/case-detail/${sampleOrder.caseId}`);
  });

  test('should render trustee info table with trustee name', () => {
    renderComponent();

    const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
    expect(content.textContent).toContain('John Doe');
  });

  test('should render no-match message with inline search link when matchCandidates is empty', () => {
    renderComponent();

    const link = screen.getByRole('link', { name: 'Search for a trustee.', hidden: true });
    expect(link).toBeInTheDocument();
    expect(link.closest('p')).toHaveTextContent('There are no suggested matches in CAMS.');
  });

  test('should render strongest match name in CAMS Strongest Match table', () => {
    const orderWithCandidates: TrusteeMatchVerification = {
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
    render(
      <BrowserRouter>
        <TrusteeMatchVerificationAccordion
          order={orderWithCandidates}
          orderType={orderType}
          statusType={orderStatusType}
          fieldHeaders={fieldHeaders}
        />
      </BrowserRouter>,
    );

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Match Trustee/, hidden: true })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Search for a trustee.', hidden: true }),
    ).not.toBeInTheDocument();
  });

  test('should render "Search for a different trustee." link when match candidates exist', () => {
    const orderWithCandidates: TrusteeMatchVerification = {
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
    render(
      <BrowserRouter>
        <TrusteeMatchVerificationAccordion
          order={orderWithCandidates}
          orderType={orderType}
          statusType={orderStatusType}
          fieldHeaders={fieldHeaders}
        />
      </BrowserRouter>,
    );

    const link = screen.getByRole('link', { name: /Search for a different trustee/, hidden: true });
    expect(link).toBeInTheDocument();
  });

  test('should render "Pending Review" status for pending order', () => {
    renderComponent();

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('Pending Review');
  });

  test('should render "Verified" status for approved order', () => {
    renderComponent({ ...sampleOrder, status: 'approved' });

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('Verified');
  });

  test('should render "Rejected" status for rejected order', () => {
    renderComponent({ ...sampleOrder, status: 'rejected' });

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading.textContent).toContain('Rejected');
  });

  test('should not be visible when hidden is true', () => {
    renderComponent(sampleOrder, true);

    const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
    expect(heading).not.toBeVisible();
  });
});
