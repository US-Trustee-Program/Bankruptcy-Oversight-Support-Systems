import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import Api2 from '@/lib/models/api2';
import { TrusteeHistory } from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import {
  renderWithProps,
  renderHistoryAndWaitForTable,
  createMockNameHistory,
  createMockPublicContactHistory,
} from './trusteeHistoryTestHelpers';

describe('TrusteeDetailAuditHistory - Bank History Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockNameHistory = createMockNameHistory();
  const mockPublicContactHistory = createMockPublicContactHistory();

  const mockBankHistory = {
    id: 'audit-bank-1',
    documentType: 'AUDIT_BANKS' as const,
    before: ['First National Bank', 'Second Trust Bank'],
    after: ['First National Bank', 'Third Community Bank', 'Fourth Federal Bank'],
    updatedOn: '2024-01-20T10:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  describe('Bank History empty/undefined/single scenarios', () => {
    const base = { ...mockBankHistory };

    const scenarios = [
      {
        name: 'basic bank change',
        override: {},
        expectPrev: ['First National Bank', 'Second Trust Bank'],
        expectNew: ['First National Bank', 'Third Community Bank', 'Fourth Federal Bank'],
      },
      {
        name: 'no previous banks',
        override: { before: undefined, after: ['New Bank One', 'New Bank Two'] },
        expectPrev: '(none)',
        expectNew: ['New Bank One', 'New Bank Two'],
      },
      {
        name: 'no new banks',
        override: { before: ['Old Bank One', 'Old Bank Two'], after: undefined },
        expectPrev: ['Old Bank One', 'Old Bank Two'],
        expectNew: '(none)',
      },
      {
        name: 'empty arrays',
        override: { before: [], after: [] },
        expectPrev: '(none)',
        expectNew: '(none)',
      },
      {
        name: 'single bank',
        override: { before: ['Single Old Bank'], after: ['Single New Bank'] },
        expectPrev: ['Single Old Bank'],
        expectNew: ['Single New Bank'],
      },
      {
        name: 'missing updatedBy',
        override: { updatedBy: { id: '', name: '' } },
        expectPrev: ['First National Bank', 'Second Trust Bank'],
        expectNew: ['First National Bank', 'Third Community Bank', 'Fourth Federal Bank'],
        expectChangedBy: '',
      },
    ];

    test.each(scenarios)(
      'should display bank history with $name',
      async ({ override, expectPrev, expectNew, expectChangedBy = 'SYSTEM' }) => {
        vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({
          data: [{ ...base, ...override } as TrusteeHistory],
        });
        renderWithProps({});
        await screen.findByTestId('trustee-history-table');

        const prevEl = screen.getByTestId('previous-banks-0');
        const newEl = screen.getByTestId('new-banks-0');
        const changedByEl = screen.getByTestId('changed-by-0');

        const assertContent = (el: HTMLElement, exp: string | string[]) => {
          if (Array.isArray(exp)) {
            exp.forEach((txt) => expect(el).toHaveTextContent(txt));
          } else {
            expect(el).toHaveTextContent(exp);
          }
        };

        assertContent(prevEl, expectPrev);
        assertContent(newEl, expectNew);
        expect(changedByEl).toHaveTextContent(expectChangedBy);
      },
    );
  });

  test('should display mixed history types including banks', async () => {
    const mixedHistory = [mockNameHistory, mockPublicContactHistory, mockBankHistory];
    await renderHistoryAndWaitForTable(mixedHistory as TrusteeHistory[]);

    expect(screen.getByTestId('change-type-name-2')).toHaveTextContent('Name');
    expect(screen.getByTestId('change-type-public-contact-1')).toHaveTextContent('Public Contact');
    expect(screen.getByTestId('change-type-banks-0')).toHaveTextContent('Bank(s)');

    const previousBanks = screen.getByTestId('previous-banks-0');
    expect(previousBanks).toHaveTextContent('First National Bank');
    expect(previousBanks).toHaveTextContent('Second Trust Bank');
  });

  test('should render banks as an unordered list', async () => {
    const bankHistoryMultiple = {
      ...mockBankHistory,
      before: ['Bank A', 'Bank B', 'Bank C'],
      after: ['Bank X', 'Bank Y'],
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({
      data: [bankHistoryMultiple as TrusteeHistory],
    });

    renderWithProps({});

    await screen.findByTestId('trustee-history-table');

    const previousBanks = screen.getByTestId('previous-banks-0');
    const newBanks = screen.getByTestId('new-banks-0');

    expect(previousBanks.querySelector('ul')).toBeInTheDocument();
    expect(newBanks.querySelector('ul')).toBeInTheDocument();

    expect(previousBanks.querySelectorAll('li')).toHaveLength(3);
    expect(newBanks.querySelectorAll('li')).toHaveLength(2);

    expect(previousBanks).toHaveTextContent('Bank A');
    expect(previousBanks).toHaveTextContent('Bank B');
    expect(previousBanks).toHaveTextContent('Bank C');
    expect(newBanks).toHaveTextContent('Bank X');
    expect(newBanks).toHaveTextContent('Bank Y');
  });
});
