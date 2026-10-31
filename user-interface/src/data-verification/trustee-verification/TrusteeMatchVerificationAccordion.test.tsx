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
import { AccordionGroup } from '@/lib/components/uswds/Accordion';
import { CourtDivisionDetails } from '@common/cams/courts';

const fieldHeaders = ['Task Type', 'Subject', 'Task Created', 'Task Status'];

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

/**
 * Renders several accordions inside an AccordionGroup, as DataVerificationScreen does, with a
 * parent that applies onOrderUpdate's order to its own list.
 */
function renderInAccordionGroup(orders: TrusteeMatchVerificationListItem[]) {
  function Parent() {
    const [list, setList] = useState(orders);
    return (
      <AccordionGroup>
        {list.map((order) => (
          <TrusteeMatchVerificationAccordion
            key={order.id}
            order={order}
            taskType={taskType}
            statusType={orderStatusType}
            fieldHeaders={fieldHeaders}
            hidden={false}
            onOrderUpdate={(_alert, updated) =>
              setList((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
            }
          />
        ))}
      </AccordionGroup>
    );
  }
  return render(
    <BrowserRouter>
      <Parent />
    </BrowserRouter>,
  );
}

function accordionButton(orderId: string) {
  return screen.getByTestId(`accordion-button-order-list-${orderId}`);
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

function candidateRowHeaders() {
  return within(screen.getByTestId('trustee-comparison-table'))
    .queryAllByRole('rowheader', { hidden: true })
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
    // Default: no case summary available. Tests that care about the search modal's chapter
    // filter override this with their own getCaseSummary mock.
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

    test('renders without throwing for a caseless order (no caseId or courtId)', () => {
      renderWithProps({ order: { ...sampleOrder, caseId: undefined, courtId: undefined } });

      expect(screen.getByTestId(`accordion-heading-${sampleOrder.id}`)).toBeInTheDocument();
    });
  });

  describe('comparison table', () => {
    test('shows a "Trustee Information Received" table with the source record', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      expect(
        screen.getByRole('heading', { name: 'Trustee Information Received' }),
      ).toBeInTheDocument();
      const receivedTable = screen.getByTestId('trustee-information-received-table');
      expect(receivedTable).toHaveTextContent('John Doe');
      expect(receivedTable).toHaveTextContent('123 Main St');
      expect(receivedTable).toHaveTextContent('212-555-0100');
    });

    // Column rendering and per-candidate difference markers are TrusteeComparisonTable's own
    // concern, covered by its own test suite; this only confirms the accordion hands it the
    // pipeline-ranked candidate data.
    test('passes the pipeline-ranked candidates through to the comparison table', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      expect(candidateRowHeaders()).toEqual(['Jane Smith', 'Janet Smith']);
    });

    test('no longer shows the "Sent By Court" heading', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      const content = screen.getByTestId(`accordion-content-${sampleOrder.id}`);
      expect(content.textContent).not.toContain('Sent By Court');
    });

    test('gives the comparison table an accessible name via the Potential Matches heading', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      const heading = screen.getByRole('heading', { name: 'Potential Matches' });
      const table = screen.getByTestId('trustee-comparison-table');
      expect(heading).toHaveAttribute('id', table.getAttribute('aria-labelledby'));
    });

    test('names the legend warning icon "warning" so screen readers do not announce "warning icon icon"', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      const legend = document.querySelector('.other-matches-subtext') as HTMLElement;
      expect(legend).not.toBeNull();
      expect(within(legend).getByRole('img', { name: 'warning' })).toBeInTheDocument();
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

      expect(candidateRowHeaders()).toEqual(['Jane Smith', 'Janet Smith', 'June Smith']);
    });

    test('shows only the source record and a search link when there are no candidates', async () => {
      renderWithProps();
      await mockDetailAndExpand({ ...sampleOrderDetail, findings: findings([]) });

      expect(screen.queryByTestId('trustee-comparison-table')).not.toBeInTheDocument();
      expect(screen.getByTestId('trustee-information-received-table')).toHaveTextContent(
        'John Doe',
      );
      expect(screen.queryByRole('heading', { name: 'Potential Matches' })).not.toBeInTheDocument();
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
      expect(screen.queryByTestId('affected-cases-loading')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /22-11111/, hidden: true })).toHaveAttribute(
        'href',
        `/case-detail/${sampleOrder.caseId}`,
      );
    });

    test('shows the multi-case count from the list response when loading the task details fails', async () => {
      vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockRejectedValue(
        new Error('Network error'),
      );
      renderWithProps({ order: { ...sampleOrder, affectedCaseCount: 3 } });

      await expandAccordion(sampleOrder.id);

      await waitFor(() => {
        expect(screen.getByTestId('affected-cases').textContent).toBe('3 cases');
      });
      expect(screen.queryByTestId('affected-cases-loading')).not.toBeInTheDocument();
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

    // Both fields are optional on the type (TrusteeMatchVerification carries no status-linked
    // discriminated union), but approveVerification's resolvedTrusteeId parameter is a required
    // string, so every order this backend use case approves has at least one of the two set.
    // This state is reachable only if some other, currently nonexistent producer wrote an
    // "approved" document without it.
    test('renders an empty trustee name when both resolvedTrusteeName and resolvedTrusteeId are absent', () => {
      renderWithProps({
        order: {
          ...resolvedOrder,
          resolvedTrusteeName: undefined,
          resolvedTrusteeId: undefined,
          affectedCaseCount: 0,
          affectedCaseIds: [],
        },
      });

      expect(screen.getByTestId('resolved-statement').textContent).toBe(
        'Trustee  was approved. No cases affected.',
      );
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

    test('shows no case link for a resolved task with an empty affectedCaseIds snapshot', () => {
      renderWithProps({ order: { ...resolvedOrder, affectedCaseCount: 0, affectedCaseIds: [] } });

      expect(screen.getByTestId('resolved-statement').textContent).toBe(
        'Trustee Jane Smith was approved. No cases affected.',
      );
      expect(
        screen.queryByRole('link', { name: /22-11111/, hidden: true }),
      ).not.toBeInTheDocument();
    });

    test('shows the same empty-snapshot statement for a caseless resolved task', () => {
      renderWithProps({
        order: {
          ...resolvedOrder,
          caseId: undefined,
          courtId: undefined,
          affectedCaseCount: 0,
          affectedCaseIds: [],
        },
      });

      expect(screen.getByTestId('resolved-statement').textContent).toBe(
        'Trustee Jane Smith was approved. No cases affected.',
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

  describe('inside an accordion group', () => {
    const secondOrder: TrusteeMatchVerificationListItem = { ...sampleOrder, id: 'order-2' };

    beforeEach(() => {
      vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail').mockImplementation(
        async (id: string) => ({ data: { ...sampleOrderDetail, id } }) as never,
      );
    });

    test('expanding a second task collapses the first', async () => {
      renderInAccordionGroup([sampleOrder, secondOrder]);

      fireEvent.click(accordionButton(sampleOrder.id));
      await waitFor(() =>
        expect(accordionButton(sampleOrder.id)).toHaveAttribute('aria-expanded', 'true'),
      );
      fireEvent.click(accordionButton(secondOrder.id));

      await waitFor(() =>
        expect(accordionButton(secondOrder.id)).toHaveAttribute('aria-expanded', 'true'),
      );
      expect(accordionButton(sampleOrder.id)).toHaveAttribute('aria-expanded', 'false');
    });

    test('clicking an expanded task collapses it', async () => {
      renderInAccordionGroup([sampleOrder, secondOrder]);

      fireEvent.click(accordionButton(sampleOrder.id));
      await waitFor(() =>
        expect(accordionButton(sampleOrder.id)).toHaveAttribute('aria-expanded', 'true'),
      );
      fireEvent.click(accordionButton(sampleOrder.id));

      await waitFor(() =>
        expect(accordionButton(sampleOrder.id)).toHaveAttribute('aria-expanded', 'false'),
      );
    });

    test('still loads the task details when expanded', async () => {
      renderInAccordionGroup([sampleOrder, secondOrder]);

      fireEvent.click(accordionButton(secondOrder.id));

      await waitFor(() =>
        expect(Api2.getTrusteeMatchVerificationDetail).toHaveBeenCalledWith(secondOrder.id),
      );
    });

    test('stays expanded and focuses the resolved statement after an approval', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      renderInAccordionGroup([sampleOrder, secondOrder]);

      fireEvent.click(accordionButton(sampleOrder.id));
      fireEvent.click(await screen.findByTestId('approve-candidate-trustee-1'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => expect(screen.getByTestId('resolved-statement')).toHaveFocus());
      expect(accordionButton(sampleOrder.id)).toHaveAttribute('aria-expanded', 'true');
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

    test('does not refetch detail on collapse and re-expand once it has already loaded', async () => {
      const detailSpy = vi.spyOn(Api2, 'getTrusteeMatchVerificationDetail');
      renderWithProps();
      await mockDetailAndExpand();
      expect(detailSpy).toHaveBeenCalledTimes(1);

      fireEvent.click(accordionButton(sampleOrder.id));
      await waitFor(() =>
        expect(accordionButton(sampleOrder.id)).toHaveAttribute('aria-expanded', 'false'),
      );
      fireEvent.click(accordionButton(sampleOrder.id));
      await waitFor(() =>
        expect(accordionButton(sampleOrder.id)).toHaveAttribute('aria-expanded', 'true'),
      );

      expect(detailSpy).toHaveBeenCalledTimes(1);
    });

    test('fetches the case summary for the originating case only', async () => {
      const caseSummarySpy = vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({
        data: MockData.getCaseSummary({ override: { caseId: sampleOrder.caseId } }),
      });

      renderWithProps();
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        affectedCaseIds: [sampleOrder.caseId!, '081-22-22222', '081-22-33333'],
      });

      await waitFor(() => expect(caseSummarySpy).toHaveBeenCalledWith(sampleOrder.caseId));
      expect(caseSummarySpy).toHaveBeenCalledTimes(1);
    });

    test('does not fetch a case summary for a caseless pending task, even when expanded', async () => {
      const caseSummarySpy = vi.spyOn(Api2, 'getCaseSummary');

      renderWithProps({ order: { ...sampleOrder, caseId: undefined, courtId: undefined } });
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        caseId: undefined,
        courtId: undefined,
        affectedCaseIds: [],
      });

      expect(caseSummarySpy).not.toHaveBeenCalled();
    });
  });

  describe('approval', () => {
    test('Match Trustee opens the confirmation for the chosen candidate with the affected case count', async () => {
      // Wiring only: the modal's own rendering (hrefs, markers, sentence wording) is covered by
      // its own tests. This proves the accordion passed the chosen candidate and case count.
      renderWithProps();
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        affectedCaseIds: ['081-22-11111', '081-22-22222', '081-22-33333'],
      });

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-2'));

      expect(
        within(screen.getByTestId('confirm-match-selected')).getByText('Janet Smith'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId(`modal-trustee-confirmation-modal-${sampleOrder.id}`),
      ).toHaveTextContent('3');
    });

    test('passes a zero case count to the confirmation modal for a caseless task', async () => {
      // Wiring only: confirms the accordion no longer floors the case count to 1 before passing
      // it down. The modal's own zero-case sentence text is covered by its own tests.
      renderWithProps({ order: { ...sampleOrder, caseId: undefined, courtId: undefined } });
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        caseId: undefined,
        courtId: undefined,
        affectedCaseIds: [],
      });

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-2'));

      expect(
        screen.getByTestId(`modal-trustee-confirmation-modal-${sampleOrder.id}`),
      ).toHaveTextContent('No cases are affected yet.');
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

    test('approves the most recently previewed trustee after a cancelled preview', async () => {
      // Regression guard: a cancelled preview for one candidate must not leak into the next
      // approval, which should carry the id and name of the candidate chosen last.
      const approvalSpy = vi
        .spyOn(Api2, 'patchTrusteeVerificationOrderApproval')
        .mockResolvedValue(undefined);
      renderWithProps();
      await mockDetailAndExpand();

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      fireEvent.click(
        screen.getByTestId(`button-trustee-confirmation-modal-${sampleOrder.id}-cancel-button`),
      );
      fireEvent.click(screen.getByTestId('approve-candidate-trustee-2'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => {
        expect(approvalSpy).toHaveBeenCalledTimes(1);
        expect(approvalSpy).toHaveBeenCalledWith(sampleOrder.id, 'trustee-2', 'Janet Smith');
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

    test('returns focus to the Match Trustee button that opened the preview after Cancel', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      const approveButton = screen.getByTestId('approve-candidate-trustee-1');
      approveButton.focus();
      fireEvent.click(approveButton);
      await waitFor(() =>
        expect(
          document.getElementById(`trustee-confirmation-modal-${sampleOrder.id}-wrapper`),
        ).toHaveClass('is-visible'),
      );
      fireEvent.click(
        screen.getByTestId(`button-trustee-confirmation-modal-${sampleOrder.id}-cancel-button`),
      );

      await waitFor(() => expect(approveButton).toHaveFocus());
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

    test('reports no cases affected in the success message for a caseless task', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      const onOrderUpdate = vi.fn();
      const order = { ...sampleOrder, caseId: undefined, courtId: undefined };
      renderWithProps({ order, onOrderUpdate });
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        caseId: undefined,
        courtId: undefined,
        affectedCaseIds: [],
      });

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Trustee Jane Smith appointed. No cases affected.' }),
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
      const confirmationWrapper = () =>
        document.getElementById(`trustee-confirmation-modal-${sampleOrder.id}-wrapper`);

      fireEvent.click(screen.getByTestId('approve-candidate-trustee-1'));
      await waitFor(() => expect(confirmationWrapper()).toHaveClass('is-visible'));
      fireEvent.click(confirmModalSubmit()!);

      await waitFor(() => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          { message: 'Network error', type: UswdsAlertStyle.Error, timeOut: 8 },
          sampleOrder,
        );
      });
      await waitFor(() => expect(confirmationWrapper()).toHaveClass('is-hidden'));
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

    function setupSearchMocks(results: TrusteeSearchResult[] = manualSearchMockData) {
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
      return vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: results });
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

    /** Selects the first search result and hands it to Confirm Trustee Match. */
    async function selectTrusteeFromSearch() {
      await openSearchModal();
      fireEvent.click(await selectFirstSearchResult());
      await waitFor(() => expect(screen.getByTestId('confirm-match-selected')).toBeVisible());
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

    test('opens the search modal without throwing for a caseless pending task', async () => {
      renderWithProps({ order: { ...sampleOrder, caseId: undefined, courtId: undefined } });
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        caseId: undefined,
        courtId: undefined,
        affectedCaseIds: [],
      });

      await openSearchModal();
    });

    test('passes the courts-matched courtId, not order.courtId, to the search modal', async () => {
      // courtDivisionCode matches sampleOrder.caseId's division ('081'); courtId deliberately
      // differs from sampleOrder.courtId ('0881') so the assertion can tell which one won.
      const matchedCourt: CourtDivisionDetails = {
        courtId: 'matched-court-id',
        courtName: 'Matched District Court',
        officeName: '',
        officeCode: '',
        courtDivisionCode: '081',
        courtDivisionName: 'Manhattan',
        groupDesignator: '',
        regionId: '',
        regionName: '',
      };
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [matchedCourt] } as never);
      renderWithProps({ courts: [matchedCourt] });
      await mockDetailAndExpand();

      await openSearchModal();

      await waitFor(() => {
        const input = document.getElementById(
          `trustee-district-combobox-${sampleOrder.id}-combo-box-input`,
        ) as HTMLInputElement;
        expect(input.value).toBe('Matched District Court');
      });
    });

    test('falls back to order.courtId when no court matches by division', async () => {
      // No court in the accordion's own `courts` list matches sampleOrder.caseId's division
      // ('081'), so courtDetails is undefined and the accordion must fall back to
      // order.courtId ('0881'). The search modal does its own Api2.getCourts fetch to label
      // whatever courtId it's handed, so that fetch is mocked here with an entry matching
      // order.courtId - if the accordion wrongly passed undefined instead, this modal would
      // find no match and show no selection at all.
      const fallbackCourt: CourtDivisionDetails = {
        courtId: sampleOrder.courtId!,
        courtName: 'Fallback District Court',
        officeName: '',
        officeCode: '',
        courtDivisionCode: 'unrelated-division',
        courtDivisionName: '',
        groupDesignator: '',
        regionId: '',
        regionName: '',
      };
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [fallbackCourt] } as never);
      renderWithProps({ courts: [] });
      await mockDetailAndExpand();

      await openSearchModal();

      await waitFor(() => {
        const input = document.getElementById(
          `trustee-district-combobox-${sampleOrder.id}-combo-box-input`,
        ) as HTMLInputElement;
        expect(input.value).toBe('Fallback District Court');
      });
    });

    // Proves the accordion threads order.dxtrTrustee.legacy through to the search modal's court
    // column. Only asserts on real forwarded values (the accordion's own contract) - not on
    // TrusteeSearchModal's placeholder wording for missing fields, which is that component's own
    // concern and is already covered by TrusteeSearchModal.test.tsx.
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
      },
      {
        label: 'partial legacy info (address only)',
        legacy: { address1: '123 Main St', cityStateZipCountry: 'New York, NY 10001' },
        expectContains: ['123 Main St', 'New York, NY 10001'],
      },
    ])("the search modal's court column shows $label", async ({ legacy, expectContains }) => {
      renderWithProps({
        order: { ...sampleOrder, dxtrTrustee: { fullName: 'John Doe', legacy } },
      });
      await mockDetailAndExpand();

      fireEvent.click(searchButton());

      await waitFor(() => {
        const details = document.querySelector('.court-trustee-details');
        expectContains.forEach((text) => expect(details?.textContent).toContain(text));
      });
    });

    test('does not crash the search modal when the order has no legacy contact fields', async () => {
      renderWithProps({
        order: { ...sampleOrder, dxtrTrustee: { fullName: 'John Doe', legacy: undefined } },
      });
      await mockDetailAndExpand();

      fireEvent.click(searchButton());

      await waitFor(() => {
        expect(document.querySelector('.court-trustee-details')).toBeInTheDocument();
      });
    });

    test('selecting a search result closes search and opens Confirm Trustee Match for that trustee', async () => {
      const approvalSpy = vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval');
      setupSearchMocks();
      renderWithProps();
      await mockDetailAndExpand();

      await selectTrusteeFromSearch();

      // Wiring only: this proves the selected search result (not some other trustee) reached the
      // modal. The modal's own href rendering is covered by TrusteeMatchConfirmationModal.test.tsx.
      expect(
        within(screen.getByTestId('confirm-match-selected')).getByText('Manual Match'),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(
          document.getElementById(`trustee-search-modal-${sampleOrder.id}-wrapper`),
        ).toHaveClass('is-hidden'),
      );
      expect(approvalSpy).not.toHaveBeenCalled();
    });

    test('a trustee whose appointments cover none of the cases can still be selected', async () => {
      setupSearchMocks([
        {
          ...manualSearchMockData[0],
          appointments: [
            MockData.getTrusteeAppointment({ courtId: '999', divisionCode: '999', chapter: '13' }),
          ],
        },
      ]);
      renderWithProps();
      await mockDetailAndExpand();

      await selectTrusteeFromSearch();

      expect(
        within(screen.getByTestId('confirm-match-selected')).getByText('Manual Match'),
      ).toBeInTheDocument();
    });

    test("a searched trustee who is also a candidate keeps that candidate's stored markers", async () => {
      setupSearchMocks([
        { trusteeId: 'trustee-2', name: 'Janet Smith', appointments: [], matchType: 'exact' },
      ]);
      renderWithProps();
      await mockDetailAndExpand();

      await selectTrusteeFromSearch();

      // Wiring only: that selectedTrusteeFromSearch reuses the candidate's stored cells (so the
      // markers match) is proven in trustee-comparison.test.ts; the modal's own rendering of
      // markers is proven in TrusteeMatchConfirmationModal.test.tsx.
      expect(
        within(screen.getByTestId('confirm-match-selected')).getByText('Janet Smith'),
      ).toBeInTheDocument();
    });

    test('confirming a searched trustee calls the approval API and reports success', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      setupSearchMocks();
      const onOrderUpdate = vi.fn();
      renderWithProps({ onOrderUpdate });
      await mockDetailAndExpand();

      await selectTrusteeFromSearch();
      fireEvent.click(confirmModalSubmit()!);

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

    test('keeps focus in the preview when a search result opens it', async () => {
      setupSearchMocks();
      renderWithProps();
      await mockDetailAndExpand();

      searchButton().focus();
      await selectTrusteeFromSearch();

      const preview = document.getElementById(
        `trustee-confirmation-modal-${sampleOrder.id}-wrapper`,
      );
      await waitFor(() => expect(preview?.contains(document.activeElement)).toBe(true));
      expect(searchButton()).not.toHaveFocus();
    });

    test('returns focus to Search for a trustee when the search-selected preview is cancelled', async () => {
      setupSearchMocks();
      renderWithProps();
      await mockDetailAndExpand();

      searchButton().focus();
      await selectTrusteeFromSearch();
      fireEvent.click(
        screen.getByTestId(`button-trustee-confirmation-modal-${sampleOrder.id}-cancel-button`),
      );

      await waitFor(() => expect(searchButton()).toHaveFocus());
    });

    test('moves focus to the resolved statement after a manual-match approval', async () => {
      vi.spyOn(Api2, 'patchTrusteeVerificationOrderApproval').mockResolvedValue(undefined);
      setupSearchMocks();
      renderWithParentState();
      await mockDetailAndExpand();

      await selectTrusteeFromSearch();
      fireEvent.click(confirmModalSubmit()!);

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

      await selectTrusteeFromSearch();
      clickTwiceInSameBatch(confirmModalSubmit());

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

      await selectTrusteeFromSearch();
      fireEvent.click(confirmModalSubmit()!);

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

      await selectTrusteeFromSearch();
      fireEvent.click(confirmModalSubmit()!);

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

    test('renders a single case link (not "1 cases") for a task affecting one case', async () => {
      renderWithProps();
      await mockDetailAndExpand();

      const problemStatement = screen
        .getByTestId(`accordion-content-${sampleOrder.id}`)
        .querySelector('.problem-statement');
      expect(problemStatement?.textContent).not.toContain('cases');
      expect(screen.getByRole('link', { name: /22-11111/, hidden: true })).toHaveAttribute(
        'href',
        `/case-detail/${sampleOrder.caseId}`,
      );
    });

    test('shows "No cases affected yet." and no case link when the live count is zero', async () => {
      renderWithProps();
      await mockDetailAndExpand({ ...sampleOrderDetail, affectedCaseIds: [] });

      const problemStatement = screen
        .getByTestId(`accordion-content-${sampleOrder.id}`)
        .querySelector('.problem-statement');
      expect(problemStatement?.textContent).toContain('No cases affected yet.');
      expect(problemStatement?.textContent).not.toContain('Affects');
      expect(
        screen.queryByRole('link', { name: /22-11111/, hidden: true }),
      ).not.toBeInTheDocument();
    });

    test('shows "No cases yet. Cases attach as appointments sync." for a caseless task', async () => {
      renderWithProps({ order: { ...sampleOrder, caseId: undefined, courtId: undefined } });
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        caseId: undefined,
        courtId: undefined,
        affectedCaseIds: [],
      });

      const problemStatement = screen
        .getByTestId(`accordion-content-${sampleOrder.id}`)
        .querySelector('.problem-statement');
      expect(problemStatement?.textContent).toContain(
        'No cases yet. Cases attach as appointments sync.',
      );
      expect(problemStatement?.textContent).not.toContain('No cases affected yet.');
      expect(
        screen.queryByRole('link', { name: /22-11111/, hidden: true }),
      ).not.toBeInTheDocument();
    });

    test('shows no case count or links before expansion (the sentence needs findings)', () => {
      renderWithProps({
        order: { ...sampleOrder, affectedCaseCount: 3, affectedCaseIds: threeCases },
      });

      expect(screen.queryByTestId('affected-cases')).not.toBeInTheDocument();
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

    test('does not render the case count in bold', async () => {
      renderWithProps({
        order: { ...sampleOrder, affectedCaseCount: 3, affectedCaseIds: threeCases },
      });
      await mockDetailAndExpand({ ...sampleOrderDetail, affectedCaseIds: threeCases });

      expect(screen.getByTestId('affected-cases').querySelector('strong')).not.toBeInTheDocument();
    });
  });

  describe('"Why CAMS needs you" explanation', () => {
    // Which sentence goes with which findings shape is trustee-explanation.test.ts's contract;
    // this only proves the accordion renders buildTrusteeExplanation's output.
    test('one candidate: renders its explanation sentence', async () => {
      renderWithProps();
      await mockDetailAndExpand({
        ...sampleOrderDetail,
        findings: MockData.getTrusteeMatchScenarioFindings('oneCandidateStateDiffers'),
      });

      expect(
        screen
          .getByTestId(`accordion-content-${sampleOrder.id}`)
          .querySelector('.problem-statement')?.textContent,
      ).toContain('Trustee state sent to CAMS does not exactly match a trustee in CAMS.');
    });
  });
});
