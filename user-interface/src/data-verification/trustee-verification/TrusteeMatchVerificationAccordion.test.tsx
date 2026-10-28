import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  TrusteeMatchVerificationAccordion,
  TrusteeMatchVerificationAccordionProps,
} from './TrusteeMatchVerificationAccordion';
import {
  EnrichedTrusteeMatchVerification,
  TrusteeMatchVerificationListItem,
} from '@common/cams/trustee-match-verification';
import {
  ProjectedTrustee,
  ScoreByScorer,
  SerializedCandidate,
  TrusteeSerializedState,
} from '@common/cams/trustee-match-pipeline';
import { taskType, orderStatusType } from '@/lib/utils/labels';
import MockData from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { TrusteeSearchResult } from '@common/cams/trustee-search';

const fieldHeaders = ['Subject', 'Order Filed', 'Task Type', 'Task Status'];

const exactScores: ScoreByScorer = {
  doesNameMatch: { pass: true, quality: 'exact' },
  doesPhoneMatch: { pass: true, quality: 'exact' },
  doesAddressMatch: { pass: true, quality: 'exact', points: 6, streetCloseness: 1 },
  doesCityMatch: { pass: true },
  doesStateMatch: { pass: true },
  doesZipCodeMatch: { pass: true },
  doesEmailMatch: { pass: true },
};

function candidate(
  trusteeId: string,
  name: string,
  scores: ScoreByScorer,
): SerializedCandidate<ProjectedTrustee> {
  return {
    camsRaw: {
      trusteeId,
      firstName: name.split(' ')[0],
      lastName: name.split(' ')[1],
      name,
      address: {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: { number: '212-555-0100', extension: '7' },
      email: `${trusteeId}@example.com`,
    },
    camsNormalized: {},
    memo: {},
    scores,
    origin: 'recallBySurnameExact',
  };
}

// Discovery order puts the weaker candidate first; the table must show pipeline rank order.
const janeSmith = candidate('trustee-1', 'Jane Smith', exactScores);
const janetSmith = candidate('trustee-2', 'Janet Smith', {
  ...exactScores,
  doesNameMatch: { pass: true, quality: 'strong' },
  doesStateMatch: { pass: false },
  doesAddressMatch: { pass: true, quality: 'strong', points: 4, streetCloseness: 1 },
});

function findings(candidates: SerializedCandidate<ProjectedTrustee>[]): TrusteeSerializedState {
  return {
    sourceRaw: {
      fullName: 'John Doe',
      legacy: {
        address1: '123 Main St',
        cityStateZipCountry: 'New York NY 10001',
        phone: '212-555-0100',
        parsedCityStateZip: { city: 'New York', state: 'NY', zipCode: '10001' },
      },
    },
    sourceNormalized: {},
    memo: {},
    candidates,
    match: null,
    skip: false,
    error: null,
  };
}

const sampleOrder: TrusteeMatchVerificationListItem = {
  id: 'case-001:john doe',
  documentType: 'TRUSTEE_MATCH_VERIFICATION',
  taskType: 'trustee-match',
  caseId: '081-22-11111',
  courtId: '0881',
  status: 'pending',
  mismatchReason: 'ambiguous',
  source: 'DXTR',
  dxtrTrustee: { fullName: 'John Doe' },
  affectedCaseCount: 1,
  affectedCaseIds: ['081-22-11111'],
  taskDate: '2026-01-15T10:00:00.000Z',
};

const sampleOrderDetail: EnrichedTrusteeMatchVerification = {
  id: 'case-001:john doe',
  documentType: 'TRUSTEE_MATCH_VERIFICATION',
  taskType: 'trustee-match',
  caseId: '081-22-11111',
  courtId: '0881',
  status: 'pending',
  mismatchReason: 'ambiguous',
  source: 'DXTR',
  findings: findings([janetSmith, janeSmith]),
  dxtrTrustee: { fullName: 'John Doe' },
  updatedOn: '2026-01-15T10:00:00.000Z',
  updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
  createdOn: '2026-01-15T10:00:00.000Z',
  createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
  taskDate: '2026-01-15T10:00:00.000Z',
  fingerprint: 'fp-abc123',
  variant: '{"firstName":"john","lastName":"doe"}',
  affectedCaseIds: ['081-22-11111'],
};

const resolvedOrder: TrusteeMatchVerificationListItem = {
  ...sampleOrder,
  status: 'approved',
  resolvedTrusteeId: 'trustee-1',
  resolvedTrusteeName: 'Jane Smith',
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

/**
 * Renders the accordion under a parent that applies onOrderUpdate's order to its own state, as
 * DataVerificationScreen does, so a successful approval swaps the accordion to its resolved view.
 */
function renderWithParentState() {
  function Parent() {
    const [order, setOrder] = useState<TrusteeMatchVerificationListItem>(sampleOrder);
    return (
      <TrusteeMatchVerificationAccordion
        order={order}
        taskType={taskType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
        hidden={false}
        onOrderUpdate={(_alert, updated) => setOrder(updated)}
      />
    );
  }
  return render(
    <BrowserRouter>
      <Parent />
    </BrowserRouter>,
  );
}

/** Clicks the accordion expand button for the given order id, triggering handleExpand. */
async function expandAccordion(orderId: string) {
  fireEvent.click(screen.getByTestId(`accordion-button-order-list-${orderId}`));
  await waitFor(() => {
    expect(screen.queryByText('Loading candidate details...')).not.toBeInTheDocument();
  });
}

/** Mocks getTrusteeMatchVerificationDetail to return the given detail, then expands. */
async function mockDetailAndExpand(detail: EnrichedTrusteeMatchVerification = sampleOrderDetail) {
  vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockResolvedValue({ data: detail } as never);
  await expandAccordion(detail.id);
}

function columnHeaders() {
  return within(screen.getByTestId('trustee-comparison-table'))
    .getAllByRole('columnheader', { hidden: true })
    .map((th) => th.textContent);
}

/**
 * Clicks the given button twice inside one act() call so React doesn't get a chance to commit
 * the first click's isProcessing update (and thus disable the button) before the second fires -
 * simulating a rapid repeat invocation reaching the handler before React commits. The
 * no-unnecessary-act rule doesn't account for this: nesting changes batching timing here.
 */
function clickTwiceInSameBatch(button: HTMLElement | null) {
  // eslint-disable-next-line testing-library/no-unnecessary-act
  act(() => {
    fireEvent.click(button!);
    fireEvent.click(button!);
  });
}

function confirmModalSubmit(orderId = sampleOrder.id) {
  return document.getElementById(`trustee-confirmation-modal-${orderId}-submit-button`);
}

describe('TrusteeMatchVerificationAccordion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Default: no case summaries available. Tests that care about the search modal's coverage
    // filtering override this with their own getCaseSummary mock.
    vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue(new Error('not mocked in this test'));
  });

  describe('accordion heading', () => {
    test('shows the trustee name, date, task type, and status', () => {
      renderWithProps();

      const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
      expect(heading.textContent).toContain('John Doe');
      expect(heading.textContent).toContain('01/15/2026');
      expect(heading.textContent).toContain('Trustee Identity');
      expect(heading.textContent).toContain('Pending Review');
    });

    test('labels the Subject cell with the source trustee name', () => {
      renderWithProps();

      const heading = screen.getByTestId(`accordion-heading-${sampleOrder.id}`);
      expect(within(heading).getByText('John Doe')).toHaveAttribute(
        'aria-label',
        'Subject – John Doe.',
      );
    });

    test('shows the trustee name, not the court, even when courts and courtName are provided', () => {
      renderWithProps({
        order: { ...sampleOrder, courtName: 'Direct Court Name' },
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
      expect(heading.textContent).toContain('John Doe');
      expect(heading.textContent).not.toContain('Direct Court Name');
      expect(heading.textContent).not.toContain('Southern District of New York');
    });

    test.each([
      { status: 'approved' as const, label: 'Verified' },
      { status: 'rejected' as const, label: 'Rejected' },
    ])('shows the "$label" status label for a $status order', ({ status, label }) => {
      renderWithProps({ order: { ...sampleOrder, status } });

      expect(screen.getByTestId(`accordion-heading-${sampleOrder.id}`).textContent).toContain(
        label,
      );
    });

    test('is not visible when hidden is true', () => {
      renderWithProps({ hidden: true });

      expect(screen.getByTestId(`accordion-heading-${sampleOrder.id}`)).not.toBeVisible();
    });
  });

  describe('identity task header', () => {
    test('shows the reason label, a DXTR source badge, and the case count', () => {
      renderWithProps();

      const header = screen.getByTestId('identity-task-header');
      expect(within(header).getByTestId('identity-task-reason')).toHaveTextContent(
        'Multiple matches',
      );
      expect(within(header).getByText('DXTR')).toHaveClass('usa-tag');
      expect(within(header).getByTestId('identity-task-case-count')).toHaveTextContent('1 case');
    });

    test('labels a no-match task "No match"', () => {
      renderWithProps({ order: { ...sampleOrder, mismatchReason: 'no match' } });

      expect(screen.getByTestId('identity-task-reason')).toHaveTextContent('No match');
    });

    test('counts every affected case', () => {
      renderWithProps({
        order: {
          ...sampleOrder,
          affectedCaseCount: 3,
          affectedCaseIds: ['081-22-11111', '081-22-22222', '081-22-33333'],
        },
      });

      expect(screen.getByTestId('identity-task-case-count')).toHaveTextContent('3 cases');
    });

    test('is not shown for a resolved task', () => {
      renderWithProps({ order: resolvedOrder });

      expect(screen.queryByTestId('identity-task-header')).not.toBeInTheDocument();
    });
  });

  describe('comparison table', () => {
    test('shows the source record first, then one column per candidate in pipeline rank order', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      expect(columnHeaders()).toEqual([
        'Field',
        'Source record (DXTR)',
        'Jane Smith',
        'Janet Smith',
      ]);
    });

    test('no longer shows the "Sent By Court" heading', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).not.toContain('Sent By Court');
    });

    test('marks the fields where a candidate differs from the source record', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      const table = screen.getByTestId('trustee-comparison-table');
      const differences = within(table)
        .getAllByLabelText(/differs from the source record/, { selector: 'svg' })
        .map((icon) => icon.getAttribute('aria-label'));
      expect(differences).toEqual([
        'Name differs from the source record',
        'State differs from the source record',
      ]);
    });

    test('shows every candidate for a no-match task', async () => {
      const candidates = [
        candidate('trustee-1', 'Jane Smith', exactScores),
        candidate('trustee-2', 'Janet Smith', exactScores),
        candidate('trustee-3', 'June Smith', exactScores),
      ];
      const order = { ...sampleOrder, mismatchReason: 'no match' as const };
      renderWithProps({ order });
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        mismatchReason: 'no match',
        findings: findings(candidates),
      });

      expect(columnHeaders()).toEqual([
        'Field',
        'Source record (DXTR)',
        'Jane Smith',
        'Janet Smith',
        'June Smith',
      ]);
    });

    test('shows only the source record and a search link when there are no candidates', async () => {
      renderWithProps();
      await mockDetailAndExpand({ ...sampleOrderDetail, findings: findings([]) });

      expect(columnHeaders()).toEqual(['Field', 'Source record (DXTR)']);
      const searchButton = screen.getByRole('button', {
        name: /Search for a trustee/,
        hidden: true,
      });
      expect(searchButton.closest('.search-link-container')).toHaveTextContent(
        'There are no suggested matches in CAMS.',
      );
    });

    test('offers Match Trustee for each candidate of a pending task', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      expect(screen.getByTestId('approve-candidate-trustee-1')).toBeInTheDocument();
      expect(screen.getByTestId('approve-candidate-trustee-2')).toBeInTheDocument();
    });

    test('does not offer Match Trustee for a task that is not pending', async () => {
      const rejected = { ...sampleOrder, status: 'rejected' as const };
      renderWithProps({ order: rejected });
      await mockDetailAndExpand({ ...sampleOrderDetail, status: 'rejected' });

      expect(screen.getByTestId('trustee-comparison-table')).toBeInTheDocument();
      expect(screen.queryByTestId('approve-candidate-trustee-1')).not.toBeInTheDocument();
    });

    test('shows an error message when loading the task details fails', async () => {
      vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockRejectedValue(
        new Error('Network error'),
      );
      renderWithProps();

      await expandAccordion(sampleOrder.id);

      expect(
        screen.getByText('Failed to load candidate details. Please try again later.'),
      ).toBeInTheDocument();
    });
  });

  describe('resolved task', () => {
    test('shows the resolved statement with the trustee name and case link', () => {
      renderWithProps({ order: resolvedOrder });

      const resolved = screen.getByTestId('resolved-statement');
      expect(resolved.textContent).toContain('Jane Smith');
      expect(resolved.textContent).toContain('was appointed to case');
      const link = screen.getByRole('link', { name: /22-11111/, hidden: true });
      expect(link).toHaveAttribute('href', `/case-detail/${sampleOrder.caseId}`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(screen.queryByTestId('candidate-info')).not.toBeInTheDocument();
    });

    test('falls back to resolvedTrusteeId when resolvedTrusteeName is absent', () => {
      renderWithProps({ order: { ...resolvedOrder, resolvedTrusteeName: undefined } });

      expect(screen.getByTestId('resolved-statement').textContent).toContain('trustee-1');
    });

    test('shows case numbers from the list response without fetching detail', async () => {
      const detailSpy = vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail');
      renderWithProps({
        order: {
          ...resolvedOrder,
          affectedCaseCount: 2,
          affectedCaseIds: ['081-22-11111', '081-22-22222'],
        },
      });

      expect(screen.getByRole('link', { name: /22-11111/, hidden: true })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /22-22222/, hidden: true })).toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(detailSpy).not.toHaveBeenCalled();
    });

    test('falls back to the originating case with no snapshot and no surviving surrogates', () => {
      renderWithProps({ order: { ...resolvedOrder, affectedCaseCount: 0, affectedCaseIds: [] } });

      expect(screen.getByTestId('resolved-statement').textContent).toContain('case:');
      expect(screen.getByRole('link', { name: /22-11111/, hidden: true })).toHaveAttribute(
        'href',
        `/case-detail/${sampleOrder.caseId}`,
      );
    });

    test('does not move focus to the resolved statement for a task that was already approved', () => {
      renderWithProps({ order: resolvedOrder });

      expect(screen.getByTestId('resolved-statement')).not.toHaveFocus();
    });

    test('does not fetch detail when manually expanded', async () => {
      const detailSpy = vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail');
      renderWithProps({ order: resolvedOrder });

      fireEvent.click(screen.getByTestId(`accordion-button-order-list-${resolvedOrder.id}`));

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(detailSpy).not.toHaveBeenCalled();
    });
  });

  describe('lazy loading', () => {
    test('does not fetch detail on mount for a pending task', async () => {
      const detailSpy = vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail');

      renderWithProps();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(detailSpy).not.toHaveBeenCalled();
    });

    test('does not fetch the case summary on mount for a resolved task', async () => {
      // The accordion group keeps every row mounted, so an ungated fetch would fire once per
      // approved row on every list render with no display benefit.
      const caseSummarySpy = vi.spyOn(Api2, 'getCaseSummary');

      renderWithProps({ order: resolvedOrder });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(caseSummarySpy).not.toHaveBeenCalled();
    });

    test('does not fetch the case summary on mount for a pending, un-expanded task', async () => {
      const caseSummarySpy = vi.spyOn(Api2, 'getCaseSummary');

      renderWithProps();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(caseSummarySpy).not.toHaveBeenCalled();
    });

    test('fetches the case summary once a pending task is expanded', async () => {
      const caseSummarySpy = vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({
        data: MockData.getCaseSummary({ override: { caseId: sampleOrder.caseId } }),
      });

      renderWithProps();
      await mockDetailAndExpand();

      await waitFor(() => expect(caseSummarySpy).toHaveBeenCalledWith(sampleOrder.caseId));
    });
  });

  describe('approval', () => {
    test('Match Trustee shows the candidate from the stored findings in the confirmation modal', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));

      const modal = screen.getByTestId(`modal-trustee-confirmation-modal-${sampleOrder.id}`);
      await waitFor(() => expect(modal.textContent).toContain('Jane Smith'));
      expect(modal.textContent).toContain('123 Main St');
      expect(modal.textContent).toContain('212-555-0100 x7');
      expect(modal.textContent).toContain('trustee-1@example.com');
    });

    test('confirming calls patchTrusteeVerificationOrderApproval with the chosen candidate', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      renderWithProps();
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-2'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => {
        expect(Api2.patchTrusteeVerificationOrderApproval).toHaveBeenCalledWith(
          sampleOrder.id,
          'trustee-2',
          'Janet Smith',
        );
      });
    });

    test('threads isProcessing=true into the confirmation modal while approval is in flight', async () => {
      // Wiring only: the modal's own rendering of isProcessing is covered by its own tests.
      let resolveApproval: () => void = () => {};
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockImplementation(
        () => new Promise<void>((resolve) => (resolveApproval = () => resolve())),
      );
      renderWithProps();
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      const modalSubmit = confirmModalSubmit();
      fireEvent.click(modalSubmit!);

      await waitFor(() => expect(modalSubmit).toBeDisabled());
      resolveApproval();
      await waitFor(() => expect(modalSubmit).not.toBeDisabled());
    });

    test('ignores a second rapid approval submit while the first is still in flight', async () => {
      let resolveApproval: () => void = () => {};
      const approvalSpy = vi
        .spyOn(Api2, 'patchTrusteeVerificationOrderApproval')
        .mockImplementation(() => new Promise<void>((resolve) => (resolveApproval = resolve)));
      renderWithProps();
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      clickTwiceInSameBatch(confirmModalSubmit());

      expect(approvalSpy).toHaveBeenCalledTimes(1);
      resolveApproval();
      await waitFor(() => expect(approvalSpy).toHaveBeenCalledTimes(1));
    });

    test('calls onOrderUpdate with a success alert and the approved order', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          {
            message: 'Trustee Jane Smith appointed to case 22-11111.',
            type: UswdsAlertStyle.Success,
            timeOut: 8,
          },
          {
            ...sampleOrder,
            status: 'approved',
            resolvedTrusteeId: 'trustee-1',
            resolvedTrusteeName: 'Jane Smith',
          },
        );
      });
    });

    test('moves focus to the resolved statement after a confirmed approval', async () => {
      // The Match Trustee button that opened the modal unmounts with the pending view, so
      // focus would otherwise fall to <body>.
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      renderWithParentState();
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => expect(screen.getByTestId('resolved-statement')).toHaveFocus());
    });

    test('reports every affected case in the success message', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      const onOrderUpdate = vi.fn();
      const affectedCaseIds = ['081-22-11111', '081-22-22222'];
      renderWithProps({
        order: { ...sampleOrder, affectedCaseCount: 2, affectedCaseIds },
        onOrderUpdate,
      });
      await mockDetailAndExpand({ ...sampleOrderDetail, affectedCaseIds });

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Trustee Jane Smith appointed to 2 cases.' }),
          expect.objectContaining({ status: 'approved' }),
        );
      });
    });

    test('calls onOrderUpdate with the specific error message on failure', async () => {
      // Surfacing the caught error's own message is what lets a backend coverage rejection show
      // the user something actionable.
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockRejectedValue(
        new Error('Network error'),
      );
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          { message: 'Network error', type: UswdsAlertStyle.Error, timeOut: 8 },
          sampleOrder,
        );
      });
    });

    test('falls back to a generic message when the rejection is not an Error instance', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockRejectedValue('not an Error');
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          { message: 'Failed to confirm trustee match.', type: UswdsAlertStyle.Error, timeOut: 8 },
          sampleOrder,
        );
      });
    });
  });

  describe('manual trustee search flow', () => {
    const manualSearchMockData: TrusteeSearchResult[] = [
      { trusteeId: 'manual-trustee-1', name: 'Manual Match', appointments: [], matchType: 'exact' },
    ];

    function setupSearchMocks() {
      // The search modal's Confirm button gates on bundle-wide coverage (getUncoveredCases), so
      // the default fixture is a trustee who genuinely covers the affected case.
      vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({
        data: MockData.getCaseSummary({
          override: {
            caseId: sampleOrder.caseId,
            chapter: '7',
            courtId: '081',
            courtDivisionCode: '081',
          },
        }),
      });
      return vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({
        data: [
          {
            ...manualSearchMockData[0],
            appointments: [
              MockData.getTrusteeAppointment({ courtId: '081', divisionCode: '081', chapter: '7' }),
            ],
          },
        ],
      });
    }

    function searchButton() {
      return screen.getByRole('button', { name: /Search for a trustee/, hidden: true });
    }

    async function openSearchModal() {
      fireEvent.click(searchButton());
      await waitFor(() => {
        const wrapper = document.getElementById(`trustee-search-modal-${sampleOrder.id}-wrapper`);
        expect(wrapper).toHaveClass('is-visible');
      });
    }

    async function selectFirstSearchResult() {
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
      return submitButton;
    }

    test('offers search as a button, not a link', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      expect(searchButton()).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /Search for a trustee/, hidden: true }),
      ).not.toBeInTheDocument();
    });

    test('clicking search opens the TrusteeSearchModal', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      await openSearchModal();
    });

    // Proves the accordion threads order.dxtrTrustee.legacy through to the search modal's court
    // column; TrusteeSearchModal.test.tsx covers the placeholder rendering itself.
    test.each([
      {
        label: 'full legacy contact info',
        legacy: {
          address1: '123 Main St',
          address2: 'Suite 200',
          cityStateZipCountry: 'New York, NY 10001',
          phone: '555-1234',
          email: 'john@example.com',
        },
        expectContains: [
          'John Doe',
          '123 Main St',
          'Suite 200',
          'New York, NY 10001',
          '555-1234',
          'john@example.com',
        ],
        expectNotContains: [] as string[],
      },
      {
        label: 'no legacy contact fields',
        legacy: undefined,
        expectContains: ['Address not provided', 'Phone not provided', 'Email not provided'],
        expectNotContains: [] as string[],
      },
      {
        label: 'partial legacy info (address only)',
        legacy: { address1: '123 Main St', cityStateZipCountry: 'New York, NY 10001' },
        expectContains: [
          '123 Main St',
          'New York, NY 10001',
          'Phone not provided',
          'Email not provided',
        ],
        expectNotContains: ['Address not provided'],
      },
    ])(
      "the search modal's court column shows $label",
      async ({ legacy, expectContains, expectNotContains }) => {
        renderWithProps({
          order: { ...sampleOrder, dxtrTrustee: { fullName: 'John Doe', legacy } },
        });
        await mockDetailAndExpand();

        fireEvent.click(searchButton());

        await waitFor(() => {
          const details = document.querySelector('.court-trustee-details');
          expectContains.forEach((text) => expect(details?.textContent).toContain(text));
          expectNotContains.forEach((text) => expect(details?.textContent).not.toContain(text));
        });
      },
    );

    test('confirming a search result calls the approval API and reports success', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      setupSearchMocks();
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });
      await mockDetailAndExpand();

      await openSearchModal();
      fireEvent.click(await selectFirstSearchResult());

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

    test('moves focus to the resolved statement after a manual-match approval', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      setupSearchMocks();
      renderWithParentState();
      await mockDetailAndExpand();

      await openSearchModal();
      fireEvent.click(await selectFirstSearchResult());

      await waitFor(() => expect(screen.getByTestId('resolved-statement')).toHaveFocus());
    });

    test('ignores a second rapid manual-match submit while the first is still in flight', async () => {
      let resolveApproval: () => void = () => {};
      const approvalSpy = vi
        .spyOn(Api2, 'patchTrusteeVerificationOrderApproval')
        .mockImplementation(() => new Promise<void>((resolve) => (resolveApproval = resolve)));
      setupSearchMocks();
      renderWithProps();
      await mockDetailAndExpand();

      await openSearchModal();
      clickTwiceInSameBatch(await selectFirstSearchResult());

      expect(approvalSpy).toHaveBeenCalledTimes(1);
      resolveApproval();
      await waitFor(() => expect(approvalSpy).toHaveBeenCalledTimes(1));
    });

    test('a failed manual approval reports the specific error message', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockRejectedValue(
        new Error('Network error'),
      );
      setupSearchMocks();
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });
      await mockDetailAndExpand();

      await openSearchModal();
      fireEvent.click(await selectFirstSearchResult());

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ type: UswdsAlertStyle.Error, message: 'Network error' }),
          sampleOrder,
        );
      });
    });

    test('falls back to a generic message when the manual-match rejection is not an Error instance', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockRejectedValue('not an Error');
      setupSearchMocks();
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });
      await mockDetailAndExpand();

      await openSearchModal();
      fireEvent.click(await selectFirstSearchResult());

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            type: UswdsAlertStyle.Error,
            message: 'Failed to confirm trustee match.',
          }),
          sampleOrder,
        );
      });
    });

    test('threads the resolved case chapter into the search call for division-aware filtering', async () => {
      const searchSpy = setupSearchMocks();
      renderWithProps();
      await mockDetailAndExpand();

      await openSearchModal();
      await selectFirstSearchResult();

      const [, , divisionCode, chapter] = searchSpy.mock.calls[0];
      expect(divisionCode).toBe('081');
      expect(chapter).toBe('7');
    });

    test('falls back to district-only filtering when the case-summary fetch fails', async () => {
      const searchSpy = vi
        .spyOn(Api2, 'searchTrustees')
        .mockResolvedValue({ data: manualSearchMockData });
      renderWithProps();
      await mockDetailAndExpand();

      await openSearchModal();
      const comboBoxId = `trustee-search-combobox-${sampleOrder.id}`;
      fireEvent.click(document.getElementById(`${comboBoxId}-expand`)!);
      fireEvent.change(
        document.getElementById(`${comboBoxId}-combo-box-input`) as HTMLInputElement,
        { target: { value: 'manual' } },
      );

      await waitFor(() => expect(searchSpy).toHaveBeenCalled());
      const [, , , chapter] = searchSpy.mock.calls[0];
      expect(chapter).toBeUndefined();
    });
  });

  describe('affected case count/list display', () => {
    const threeCases = ['081-22-11111', '081-22-22222', '081-22-33333'];

    test('renders a single case link (not "1 cases") for a task affecting one case', () => {
      renderWithProps();

      const problemStatement = screen
        .getByTestId(`accordion-content-${sampleOrder.id}`)
        .querySelector('.problem-statement');
      expect(problemStatement?.textContent).not.toContain('cases');
      expect(screen.getByRole('link', { name: /22-11111/, hidden: true })).toHaveAttribute(
        'href',
        `/case-detail/${sampleOrder.caseId}`,
      );
    });

    test('falls back to the originating case link when the detail has zero affected cases', async () => {
      renderWithProps();
      await mockDetailAndExpand({ ...sampleOrderDetail, affectedCaseIds: [] });

      expect(screen.getByRole('link', { name: /22-11111/, hidden: true })).toHaveAttribute(
        'href',
        `/case-detail/${sampleOrder.caseId}`,
      );
    });

    test('shows "N cases" with no links before expansion', () => {
      renderWithProps({
        order: { ...sampleOrder, affectedCaseCount: 3, affectedCaseIds: threeCases },
      });

      expect(screen.getByTestId('affected-cases').textContent).toBe('3 cases');
      expect(
        screen.queryByRole('link', { name: /22-11111/, hidden: true }),
      ).not.toBeInTheDocument();
    });

    test('renders a link per affected case, sorted ascending, once detail loads', async () => {
      const unsorted = ['081-22-33333', '081-22-11111', '081-22-22222'];
      renderWithProps({
        order: { ...sampleOrder, affectedCaseCount: 3, affectedCaseIds: unsorted },
      });
      await mockDetailAndExpand({ ...sampleOrderDetail, affectedCaseIds: unsorted });

      const affectedCases = screen.getByTestId('affected-cases');
      expect(affectedCases.textContent).toMatch(/^3 cases:/);
      const links = within(affectedCases).getAllByRole('link', { hidden: true });
      expect(links.map((link) => link.textContent)).toEqual(['22-11111', '22-22222', '22-33333']);
    });

    test('shows a loading indicator instead of the live count while detail is being fetched', async () => {
      let resolveDetail: (value: { data: EnrichedTrusteeMatchVerification }) => void;
      const detailPromise = new Promise<{ data: EnrichedTrusteeMatchVerification }>((resolve) => {
        resolveDetail = resolve;
      });
      vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockReturnValue(detailPromise as never);
      renderWithProps();

      fireEvent.click(screen.getByTestId(`accordion-button-order-list-${sampleOrder.id}`));

      await waitFor(() => {
        expect(screen.getByTestId('affected-cases-loading')).toBeInTheDocument();
      });
      expect(
        screen.queryByRole('link', { name: /22-11111/, hidden: true }),
      ).not.toBeInTheDocument();

      resolveDetail!({ data: { ...sampleOrderDetail, affectedCaseIds: threeCases } });

      await waitFor(() => {
        expect(screen.getByTestId('affected-cases').textContent).toContain('3 cases');
      });
    });

    test('does not render the case count in bold', () => {
      renderWithProps({
        order: { ...sampleOrder, affectedCaseCount: 3, affectedCaseIds: threeCases },
      });

      expect(screen.getByTestId('affected-cases').querySelector('strong')).not.toBeInTheDocument();
    });
  });
});
